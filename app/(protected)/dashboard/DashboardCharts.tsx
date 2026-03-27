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

  useEffect(() => {
    loadAndProject();
  }, [forecastMonths]);

  async function loadAndProject() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // 1. 현재 유동자산 잔액 (예측 시작점)
    const { data: balances } = await supabase.rpc("get_all_account_balances", {
      p_user_id: user.id,
    });

    const allBalances = (balances || []) as {
      account_id: string;
      account_name: string;
      account_type: string;
      balance: number;
    }[];

    const currentAssets = allBalances
      .filter((b) => b.account_type === "asset")
      .reduce((sum, b) => sum + b.balance, 0);
    const currentLiabilities = allBalances
      .filter((b) => b.account_type === "liability")
      .reduce((sum, b) => sum + Math.abs(b.balance), 0);
    const currentBalance = currentAssets; // 유동자산 기준

    // 2. 과거 월별 지출/수입 데이터 (최근 6개월)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = sixMonthsAgo.toISOString().split("T")[0];

    const { data: entries } = await supabase
      .from("journal_entries")
      .select("entry_date, tx_type, postings(amount, accounts:account_id(type))")
      .eq("user_id", user.id)
      .gte("entry_date", startDate)
      .order("entry_date");

    // 월별 변동 지출/수입 집계
    const monthlyExpenses: Record<string, number> = {};
    const monthlyIncomes: Record<string, number> = {};

    for (const entry of (entries || []) as unknown as {
      entry_date: string;
      tx_type: string;
      postings: { amount: number; accounts: { type: string } | null }[];
    }[]) {
      const month = entry.entry_date.substring(0, 7);
      if (entry.tx_type === "expense") {
        const total = entry.postings
          .filter((p) => p.amount > 0 && p.accounts?.type === "expense")
          .reduce((sum, p) => sum + p.amount, 0);
        monthlyExpenses[month] = (monthlyExpenses[month] || 0) + total;
      } else if (entry.tx_type === "income") {
        const total = entry.postings
          .filter((p) => p.amount > 0 && p.accounts?.type === "asset")
          .reduce((sum, p) => sum + p.amount, 0);
        monthlyIncomes[month] = (monthlyIncomes[month] || 0) + total;
      }
    }

    const expenseHistory = Object.values(monthlyExpenses);
    const incomeHistory = Object.values(monthlyIncomes);

    // 3. 반복 거래 조회
    const { data: recurringRules } = await supabase
      .from("recurring_rules")
      .select("postings_template, tx_type, flow_type")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const fixedRecurring = ((recurringRules || []) as {
      postings_template: { amount: number }[];
      tx_type: string;
      flow_type: string;
    }[])
      .filter((r) => r.flow_type === "fixed_recurring")
      .map((r) => ({
        amount: r.postings_template
          .filter((p) => p.amount > 0)
          .reduce((sum, p) => sum + p.amount, 0),
        isIncome: r.tx_type === "income",
      }));

    // 4. 준비금 조회
    const { data: provisions } = await supabase
      .from("provisions")
      .select("monthly_accrual")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const monthlyProvisionTotal = ((provisions || []) as { monthly_accrual: number }[])
      .reduce((sum, p) => sum + p.monthly_accrual, 0);

    // 5. 예측 생성
    const proj = generateProjection({
      currentBalance,
      forecastMonths,
      fixedRecurring,
      scheduledItems: [],
      variableExpenseHistory: expenseHistory,
      variableIncomeHistory: incomeHistory,
      monthlyProvisionTotal,
    });

    setProjections(proj);

    // 6. 순자산 추이 (과거 월별 + 미래 예측)
    const months = Object.keys({ ...monthlyExpenses, ...monthlyIncomes }).sort();
    const netWorth: { month: string; netWorth: number }[] = [];

    // 과거: 현재 순자산에서 역산 (간단 근사)
    let runningNetWorth = currentAssets - currentLiabilities;
    const pastData: { month: string; netWorth: number }[] = [];
    for (let i = months.length - 1; i >= 0; i--) {
      const m = months[i];
      const income = monthlyIncomes[m] || 0;
      const expense = monthlyExpenses[m] || 0;
      pastData.unshift({ month: m, netWorth: runningNetWorth });
      runningNetWorth -= (income - expense);
    }
    netWorth.push(...pastData);

    // 미래: 예측 기반
    let futureNetWorth = currentAssets - currentLiabilities;
    for (const p of proj) {
      futureNetWorth += p.net;
      netWorth.push({ month: p.month, netWorth: futureNetWorth });
    }

    setNetWorthData(netWorth);
    setLoading(false);
  }

  return (
    <>
      {/* 미래 현금흐름 예측 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            미래 현금흐름 예측
          </h2>
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            <button
              onClick={() => setForecastMonths(6)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                forecastMonths === 6
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              6개월
            </button>
            <button
              onClick={() => setForecastMonths(12)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                forecastMonths === 12
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              12개월
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">계산 중...</div>
        ) : (
          <CashFlowChart data={projections} />
        )}
      </div>

      {/* 순자산 추이 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          순자산 추이
        </h2>
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">계산 중...</div>
        ) : (
          <NetWorthChart data={netWorthData} />
        )}
      </div>
    </>
  );
}
