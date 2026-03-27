import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 준비금 적립/차감 엔진.
 *
 * - 가상 적립: 매월 회계상으로만 적립 (실제 돈 이동 없음)
 *   분개: Dr. 준비금적립비용(expense) / Cr. 준비금계정(liability)
 * - 차감: 해당 지출 발생 시 준비금에서 차감
 *   분개: Dr. 준비금계정(liability) / Cr. 준비금적립비용(expense) — 비용 상쇄
 * - 보수적 예측: 적립액을 예측상 지출로 반영
 */

interface Provision {
  id: string;
  user_id: string;
  name: string;
  provision_account_id: string;
  monthly_accrual: number;
  is_active: boolean;
  created_at: string;
}

/**
 * 특정 날짜까지의 미생성 준비금 적립 분개를 일괄 생성한다.
 * 각 준비금에 대해 생성 월 ~ asOfDate까지 매월 적립.
 */
export async function generatePendingProvisionAccruals(
  supabase: SupabaseClient,
  userId: string,
  asOfDate: string = new Date().toISOString().split("T")[0]
): Promise<number> {
  const { data: provisions } = await supabase
    .from("provisions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!provisions?.length) return 0;

  // 준비금 적립용 비용 계정 확인/생성
  let { data: provExpenseAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("code", "5995")
    .single();

  if (!provExpenseAccount) {
    const { data: created } = await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        code: "5995",
        name: "준비금 적립",
        type: "expense",
        is_system: true,
      })
      .select("id")
      .single();
    provExpenseAccount = created;
  }

  if (!provExpenseAccount) return 0;

  // 이미 생성된 준비금 적립 분개 조회
  const { data: existingEntries } = await supabase
    .from("journal_entries")
    .select("reference, entry_date")
    .eq("user_id", userId)
    .eq("source", "system")
    .like("description", "준비금 적립:%");

  const existingSet = new Set(
    (existingEntries || []).map((e) => `${e.reference}:${e.entry_date}`)
  );

  let created = 0;
  const asOf = new Date(asOfDate);

  for (const prov of provisions as Provision[]) {
    const startDate = new Date(prov.created_at);
    let year = startDate.getFullYear();
    let month = startDate.getMonth();

    while (true) {
      const accrualDate = new Date(year, month, 1);
      if (accrualDate > asOf) break;

      const dateStr = accrualDate.toISOString().split("T")[0];
      const key = `provision:${prov.id}:${dateStr}`;

      if (!existingSet.has(key)) {
        // Dr. 준비금적립비용 / Cr. 준비금계정(liability)
        await supabase.rpc("create_journal_entry", {
          p_user_id: userId,
          p_entry_date: dateStr,
          p_effective_date: dateStr,
          p_description: `준비금 적립: ${prov.name}`,
          p_source: "system",
          p_tx_type: "expense",
          p_postings: [
            { account_id: provExpenseAccount.id, amount: prov.monthly_accrual },
            { account_id: prov.provision_account_id, amount: -prov.monthly_accrual },
          ],
        });
        created++;
      }

      month++;
      if (month > 11) { month = 0; year++; }
    }
  }

  return created;
}

/**
 * 준비금 현재 잔액 조회 (적립 누계 - 차감 누계).
 */
export async function getProvisionBalances(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; name: string; balance: number; monthlyAccrual: number }[]> {
  const { data: provisions } = await supabase
    .from("provisions")
    .select("id, name, provision_account_id, monthly_accrual")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!provisions?.length) return [];

  const results = [];
  for (const prov of provisions) {
    const { data: balance } = await supabase.rpc("get_account_balance", {
      p_account_id: prov.provision_account_id,
    });
    results.push({
      id: prov.id,
      name: prov.name,
      balance: Math.abs((balance as number) || 0), // liability는 음수로 저장되므로 절대값
      monthlyAccrual: prov.monthly_accrual,
    });
  }

  return results;
}

/**
 * 예측용: 전체 월간 준비금 적립 총액.
 */
export async function getTotalMonthlyProvisionAccrual(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: provisions } = await supabase
    .from("provisions")
    .select("monthly_accrual")
    .eq("user_id", userId)
    .eq("is_active", true);

  return (provisions || []).reduce((sum, p) => sum + (p.monthly_accrual || 0), 0);
}
