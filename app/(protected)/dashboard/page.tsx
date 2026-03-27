import { createClient } from "@/lib/supabase/server";
import { formatKRW } from "@/lib/utils/currency";
import { DashboardCharts } from "./DashboardCharts";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // 순자산: 전체 기간 누적 잔액
  const { data: allBalances } = await supabase.rpc("get_all_account_balances", {
    p_user_id: user!.id,
    p_as_of: today,
  });

  const balances = (allBalances || []) as {
    account_id: string;
    account_name: string;
    account_type: string;
    balance: number;
  }[];

  const totalAssets = balances
    .filter((b) => b.account_type === "asset")
    .reduce((sum, b) => sum + b.balance, 0);
  const totalLiabilities = balances
    .filter((b) => b.account_type === "liability")
    .reduce((sum, b) => sum + Math.abs(b.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  // 이번 달 수입/비용: 이번 달 분개의 postings만 집계
  const { data: monthEntries } = await supabase
    .from("journal_entries")
    .select("tx_type, postings(amount, accounts:account_id(type))")
    .eq("user_id", user!.id)
    .gte("effective_date", monthStart)
    .lte("effective_date", today);

  let monthlyIncome = 0;
  let monthlyExpense = 0;

  for (const entry of (monthEntries || []) as unknown as {
    tx_type: string;
    postings: { amount: number; accounts: { type: string } | null }[];
  }[]) {
    for (const p of entry.postings) {
      if (p.accounts?.type === "income" && p.amount < 0) {
        monthlyIncome += Math.abs(p.amount); // 수입 계정은 대변(음수)에 기록됨
      }
      if (p.accounts?.type === "expense" && p.amount > 0) {
        monthlyExpense += p.amount; // 비용 계정은 차변(양수)에 기록됨
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        대시보드
      </h1>

      {/* 이번 달 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">이번 달 수입</p>
          <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
            {formatKRW(monthlyIncome)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">이번 달 비용</p>
          <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {formatKRW(monthlyExpense)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">순자산</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatKRW(netWorth)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            자산 {formatKRW(totalAssets)} - 부채 {formatKRW(totalLiabilities)}
          </p>
        </div>
      </div>

      {/* 차트 영역 (Client Component) */}
      <DashboardCharts />
    </div>
  );
}
