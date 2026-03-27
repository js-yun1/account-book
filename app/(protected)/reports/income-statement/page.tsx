"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";
import { MonthSelector } from "@/app/components/ui/MonthSelector";

export default function IncomeStatementPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [incomeItems, setIncomeItems] = useState<{ name: string; amount: number }[]>([]);
  const [expenseItems, setExpenseItems] = useState<{ name: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [year, month] = selectedMonth.split("-").map(Number);
    const monthStart = `${selectedMonth}-01`;
    const nextMonth = new Date(year, month, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

    // 해당 월의 분개 조회
    const { data: entries } = await supabase
      .from("journal_entries")
      .select("tx_type, postings(amount, accounts:account_id(name, type))")
      .eq("user_id", user.id)
      .gte("effective_date", monthStart)
      .lt("effective_date", monthEnd);

    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};

    for (const entry of (entries || []) as unknown as {
      tx_type: string;
      postings: { amount: number; accounts: { name: string; type: string } | null }[];
    }[]) {
      for (const p of entry.postings) {
        if (p.accounts?.type === "income" && p.amount < 0) {
          incomeMap[p.accounts.name] = (incomeMap[p.accounts.name] || 0) + Math.abs(p.amount);
        }
        if (p.accounts?.type === "expense" && p.amount > 0) {
          expenseMap[p.accounts.name] = (expenseMap[p.accounts.name] || 0) + p.amount;
        }
      }
    }

    setIncomeItems(Object.entries(incomeMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount));
    setExpenseItems(Object.entries(expenseMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount));
    setLoading(false);
  }

  const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
  const totalExpense = expenseItems.reduce((s, i) => s + i.amount, 0);
  const netSavings = totalIncome - totalExpense;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">월간 손익</h1>
        <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">불러오는 중...</div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          <div className="p-4">
            <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">수입</h3>
            {incomeItems.length === 0 ? (
              <p className="text-sm text-gray-400">수입 내역 없음</p>
            ) : (
              incomeItems.map((item, i) => (
                <div key={i} className="flex justify-between py-1 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatKRW(item.amount)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-800 text-sm font-semibold">
              <span>수입 합계</span>
              <span className="text-green-600 dark:text-green-400">{formatKRW(totalIncome)}</span>
            </div>
          </div>

          <div className="p-4">
            <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">비용 (목적별)</h3>
            {expenseItems.length === 0 ? (
              <p className="text-sm text-gray-400">비용 내역 없음</p>
            ) : (
              expenseItems.map((item, i) => (
                <div key={i} className="flex justify-between py-1 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatKRW(item.amount)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-800 text-sm font-semibold">
              <span>비용 합계</span>
              <span className="text-red-600 dark:text-red-400">{formatKRW(totalExpense)}</span>
            </div>
          </div>

          <div className="p-4">
            <div className="flex justify-between text-base font-bold">
              <span className="text-gray-900 dark:text-gray-100">{netSavings >= 0 ? "순저축" : "순소비"}</span>
              <span className={netSavings >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                {formatKRW(Math.abs(netSavings))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
