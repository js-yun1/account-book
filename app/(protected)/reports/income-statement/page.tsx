import { createClient } from "@/lib/supabase/server";
import { formatKRW } from "@/lib/utils/currency";

export default async function IncomeStatementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const asOf = now.toISOString().split("T")[0];

  const { data } = await supabase.rpc("get_all_account_balances", {
    p_user_id: user!.id,
    p_as_of: asOf,
  });

  const balances = (data || []) as {
    account_name: string;
    account_type: string;
    balance: number;
  }[];

  const incomeItems = balances.filter((b) => b.account_type === "income");
  const expenseItems = balances.filter((b) => b.account_type === "expense");

  const totalIncome = incomeItems.reduce((sum, b) => sum + Math.abs(b.balance), 0);
  const totalExpense = expenseItems.reduce((sum, b) => sum + b.balance, 0);
  const netSavings = totalIncome - totalExpense;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">월간 손익</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {now.getFullYear()}년 {now.getMonth() + 1}월 (발생주의 기준)
      </p>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div className="p-4">
          <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">수입</h3>
          {incomeItems.length === 0 ? (
            <p className="text-sm text-gray-400">수입 내역 없음</p>
          ) : (
            incomeItems.map((item, i) => (
              <div key={i} className="flex justify-between py-1 text-sm">
                <span className="text-gray-700 dark:text-gray-300">{item.account_name}</span>
                <span className="text-gray-900 dark:text-gray-100">{formatKRW(Math.abs(item.balance))}</span>
              </div>
            ))
          )}
          <div className="flex justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-800 text-sm font-semibold">
            <span>수입 합계</span>
            <span className="text-green-600 dark:text-green-400">{formatKRW(totalIncome)}</span>
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">비용</h3>
          {expenseItems.length === 0 ? (
            <p className="text-sm text-gray-400">비용 내역 없음</p>
          ) : (
            expenseItems.filter((item) => item.balance !== 0).map((item, i) => (
              <div key={i} className="flex justify-between py-1 text-sm">
                <span className="text-gray-700 dark:text-gray-300">{item.account_name}</span>
                <span className="text-gray-900 dark:text-gray-100">{formatKRW(item.balance)}</span>
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
            <span className="text-gray-900 dark:text-gray-100">
              {netSavings >= 0 ? "순저축" : "순소비"}
            </span>
            <span className={netSavings >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {formatKRW(Math.abs(netSavings))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
