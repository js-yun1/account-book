import { createClient } from "@/lib/supabase/server";
import { formatKRW } from "@/lib/utils/currency";

export default async function CashFlowPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // 이번 달 실제 현금 유입/유출 (entry_date 기준 = 현금주의)
  const { data: entries } = await supabase
    .from("journal_entries")
    .select(`
      tx_type,
      postings (
        amount,
        accounts:account_id (type)
      )
    `)
    .eq("user_id", user!.id)
    .gte("entry_date", monthStart)
    .order("entry_date", { ascending: false });

  let cashInflow = 0;
  let cashOutflow = 0;

  for (const entry of (entries || []) as unknown as { tx_type: string; postings: { amount: number; accounts: { type: string } | null }[] }[]) {
    for (const posting of entry.postings) {
      if (posting.accounts?.type === "asset") {
        if (posting.amount > 0) cashInflow += posting.amount;
        else cashOutflow += Math.abs(posting.amount);
      }
    }
  }

  const netCashFlow = cashInflow - cashOutflow;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">현금흐름표</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {now.getFullYear()}년 {now.getMonth() + 1}월 실제 현금 이동 (현금주의 기준)
      </p>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div className="p-4 flex justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">현금 유입</span>
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
            +{formatKRW(cashInflow)}
          </span>
        </div>
        <div className="p-4 flex justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">현금 유출</span>
          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
            -{formatKRW(cashOutflow)}
          </span>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-between text-base font-bold">
            <span className="text-gray-900 dark:text-gray-100">순 현금흐름</span>
            <span className={netCashFlow >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {formatKRW(netCashFlow)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
