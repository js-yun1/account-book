import { createClient } from "@/lib/supabase/server";
import { formatKRW } from "@/lib/utils/currency";
import { DashboardCharts } from "./DashboardCharts";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();

  const { data: incomeData } = await supabase.rpc("get_all_account_balances", {
    p_user_id: user!.id,
    p_as_of: now.toISOString().split("T")[0],
  });

  const balances = (incomeData || []) as {
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
  const totalIncome = balances
    .filter((b) => b.account_type === "income")
    .reduce((sum, b) => sum + Math.abs(b.balance), 0);
  const totalExpense = balances
    .filter((b) => b.account_type === "expense")
    .reduce((sum, b) => sum + b.balance, 0);
  const netWorth = totalAssets - totalLiabilities;

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
            {formatKRW(totalIncome)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">이번 달 비용</p>
          <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {formatKRW(totalExpense)}
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
