import { createClient } from "@/lib/supabase/server";
import { formatKRW } from "@/lib/utils/currency";

export default async function BalanceSheetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("accounts")
    .select("id, name, type, subtype, code")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .in("type", ["asset", "liability"])
    .order("code");

  const accounts = (data || []) as {
    id: string;
    name: string;
    type: string;
    subtype: string | null;
    code: string;
  }[];

  // 각 계정 잔액 조회
  const balancesPromises = accounts.map(async (acc) => {
    const { data: balance } = await supabase.rpc("get_account_balance", {
      p_account_id: acc.id,
    });
    return { ...acc, balance: (balance as number) || 0 };
  });

  const accountsWithBalances = await Promise.all(balancesPromises);

  const currentAssets = accountsWithBalances.filter(
    (a) => a.type === "asset" && a.subtype === "current" && a.balance !== 0
  );
  const nonCurrentAssets = accountsWithBalances.filter(
    (a) => a.type === "asset" && a.subtype === "non_current" && a.balance !== 0
  );
  const liabilities = accountsWithBalances.filter(
    (a) => a.type === "liability" && a.balance !== 0
  );

  const totalCurrentAssets = currentAssets.reduce((s, a) => s + a.balance, 0);
  const totalNonCurrentAssets = nonCurrentAssets.reduce((s, a) => s + a.balance, 0);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
  const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  const Section = ({ title, items, total, color }: {
    title: string;
    items: typeof currentAssets;
    total: number;
    color: string;
  }) => (
    <div className="p-4">
      <h3 className={`text-sm font-medium ${color} mb-2`}>{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">내역 없음</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="flex justify-between py-1 text-sm">
            <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
            <span className="text-gray-900 dark:text-gray-100">
              {formatKRW(item.type === "liability" ? Math.abs(item.balance) : item.balance)}
            </span>
          </div>
        ))
      )}
      <div className="flex justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-800 text-sm font-semibold">
        <span>합계</span>
        <span>{formatKRW(total)}</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">재산 현황</h1>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <Section title="유동자산" items={currentAssets} total={totalCurrentAssets} color="text-blue-600 dark:text-blue-400" />
        <Section title="비유동자산" items={nonCurrentAssets} total={totalNonCurrentAssets} color="text-purple-600 dark:text-purple-400" />
        <Section title="부채" items={liabilities} total={totalLiabilities} color="text-red-600 dark:text-red-400" />

        <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-between text-base font-bold">
            <span className="text-gray-900 dark:text-gray-100">순자산</span>
            <span className={netWorth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {formatKRW(netWorth)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            자산 {formatKRW(totalAssets)} - 부채 {formatKRW(totalLiabilities)}
          </p>
        </div>
      </div>
    </div>
  );
}
