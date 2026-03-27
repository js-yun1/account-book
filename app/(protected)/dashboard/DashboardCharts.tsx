"use client";

import { useState, useEffect } from "react";
import { CashFlowChart } from "@/app/components/charts/CashFlowChart";
import { NetWorthChart } from "@/app/components/charts/NetWorthChart";
import { generateProjection, type MonthlyProjection } from "@/lib/forecast/projection";
import { createClient } from "@/lib/supabase/client";

export function DashboardCharts() {
  const [forecastMonths, setForecastMonths] = useState<6 | 12>(6);
  const [projections, setProjections] = useState<MonthlyProjection[]>([]);
  const [netWorthData, setNetWorthData] = useState<{ month: string; netWorth: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    syncAndProject();
  }, [forecastMonths]);

  async function syncAndProject() {
    setLoading(true);

    // Step 0: 발생주의 동기화 (반복거래/준비금적립/감가상각 분개 자동 생성)
    try {
      const syncRes = await fetch("/api/accrual-sync", { method: "POST" });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.total > 0) {
          setSyncStatus(`${syncData.total}건 발생주의 분개 동기화`);
        }
      }
    } catch {
      // 동기화 실패해도 기존 데이터로 진행
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Step 1: 현재 잔액 (예측 시작점)
    const { data: balances } = await supabase.rpc("get_all_account_balances", {
      p_user_id: user.id,
    });

    const allBalances = (balances || []) as {
      account_id: string; account_name: string; account_type: string; balance: number;
    }[];

    const currentAssets = allBalances.filter((b) => b.account_type === "asset").reduce((s, b) => s + b.balance, 0);
    const currentLiabilities = allBalances.filter((b) => b.account_type === "liability").reduce((s, b) => s + Math.abs(b.balance), 0);

    // Step 2: 4유형 데이터 수집

    // 유형 1+3: 고정반복 + 예정비반복 (recurring_rules에서)
    const { data: recurringRules } = await supabase
      .from("recurring_rules")
      .select("postings_template, tx_type, flow_type, start_date")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const fixedRecurring: { amount: number; isIncome: boolean }[] = [];
    const scheduledItems: { month: string; amount: number; isIncome: boolean }[] = [];
    const now = new Date();

    for (const rule of (recurringRules || []) as {
      postings_template: { amount: number }[];
      tx_type: string; flow_type: string; start_date: string;
    }[]) {
      const amount = rule.postings_template.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
      const isIncome = rule.tx_type === "income";

      if (rule.flow_type === "fixed_recurring") {
        fixedRecurring.push({ amount, isIncome });
      } else if (rule.flow_type === "scheduled_nonrecurring") {
        const ruleDate = new Date(rule.start_date);
        if (ruleDate > now) {
          scheduledItems.push({ month: rule.start_date.substring(0, 7), amount, isIncome });
        }
      }
    }

    // 유형 2: 변동반복 (과거 월별 데이터 → EMA)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data: entries } = await supabase
      .from("journal_entries")
      .select("entry_date, tx_type, source, postings(amount, accounts:account_id(type))")
      .eq("user_id", user.id)
      .gte("entry_date", twelveMonthsAgo.toISOString().split("T")[0])
      .neq("source", "system") // 시스템 분개(감가상각/준비금) 제외 — 변동비만
      .neq("source", "recurring") // 반복거래 제외 — 변동비만
      .order("entry_date");

    const monthlyExpenses: Record<string, number> = {};
    const monthlyIncomes: Record<string, number> = {};

    for (const entry of (entries || []) as unknown as {
      entry_date: string; tx_type: string;
      postings: { amount: number; accounts: { type: string } | null }[];
    }[]) {
      const month = entry.entry_date.substring(0, 7);
      if (entry.tx_type === "expense") {
        const total = entry.postings.filter((p) => p.amount > 0 && p.accounts?.type === "expense").reduce((s, p) => s + p.amount, 0);
        monthlyExpenses[month] = (monthlyExpenses[month] || 0) + total;
      } else if (entry.tx_type === "income") {
        const total = entry.postings.filter((p) => p.amount > 0 && p.accounts?.type === "asset").reduce((s, p) => s + p.amount, 0);
        monthlyIncomes[month] = (monthlyIncomes[month] || 0) + total;
      }
    }

    // 유형 4: 준비금 (월간 적립 총액)
    const { data: provisions } = await supabase
      .from("provisions")
      .select("monthly_accrual")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const monthlyProvisionTotal = (provisions || []).reduce((s, p) => s + ((p as { monthly_accrual: number }).monthly_accrual || 0), 0);

    // Step 3: 예측 생성
    const proj = generateProjection({
      currentBalance: currentAssets,
      forecastMonths,
      fixedRecurring,
      scheduledItems,
      variableExpenseHistory: Object.values(monthlyExpenses),
      variableIncomeHistory: Object.values(monthlyIncomes),
      monthlyProvisionTotal,
    });

    setProjections(proj);

    // Step 4: 순자산 추이
    const months = Object.keys({ ...monthlyExpenses, ...monthlyIncomes }).sort();
    const netWorth: { month: string; netWorth: number }[] = [];

    let runningNetWorth = currentAssets - currentLiabilities;
    const pastData: { month: string; netWorth: number }[] = [];
    for (let i = months.length - 1; i >= 0; i--) {
      pastData.unshift({ month: months[i], netWorth: runningNetWorth });
      runningNetWorth -= ((monthlyIncomes[months[i]] || 0) - (monthlyExpenses[months[i]] || 0));
    }
    netWorth.push(...pastData);

    let futureNW = currentAssets - currentLiabilities;
    for (const p of proj) {
      futureNW += p.net;
      netWorth.push({ month: p.month, netWorth: futureNW });
    }

    setNetWorthData(netWorth);
    setLoading(false);
  }

  return (
    <>
      {syncStatus && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-4 py-2 text-xs text-blue-700 dark:text-blue-300">
          {syncStatus}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">미래 현금흐름 예측</h2>
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            {([6, 12] as const).map((m) => (
              <button key={m} onClick={() => setForecastMonths(m)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  forecastMonths === m ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"
                }`}>{m}개월</button>
            ))}
          </div>
        </div>
        {loading ? <div className="flex items-center justify-center h-64 text-gray-400">계산 중...</div> : <CashFlowChart data={projections} />}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">순자산 추이</h2>
        {loading ? <div className="flex items-center justify-center h-48 text-gray-400">계산 중...</div> : <NetWorthChart data={netWorthData} />}
      </div>
    </>
  );
}
