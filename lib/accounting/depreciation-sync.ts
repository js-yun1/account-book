import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateDepreciationSchedule } from "./depreciation";

/**
 * 감가상각 분개 자동 생성.
 *
 * assets 테이블의 active 자산에 대해,
 * 취득월 ~ asOfDate까지 매월 감가상각 분개를 생성한다.
 * 이미 생성된 분개는 건너뜀 (description + entry_date로 체크).
 *
 * 분개: Dr. 감가상각비(expense 5990) / Cr. 자산계정(asset) — 자산가치 감소
 */

interface Asset {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  acquisition_cost: number;
  residual_value: number;
  useful_life_months: number;
  acquisition_date: string;
  status: string;
}

export async function generatePendingDepreciationEntries(
  supabase: SupabaseClient,
  userId: string,
  asOfDate: string = new Date().toISOString().split("T")[0]
): Promise<number> {
  // 활성 자산 조회
  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!assets?.length) return 0;

  // 감가상각비 계정 확인
  let { data: depExpenseAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("code", "5990")
    .single();

  if (!depExpenseAccount) return 0; // 계정이 없으면 건너뜀

  // 이미 생성된 감가상각 분개
  const { data: existingEntries } = await supabase
    .from("journal_entries")
    .select("description, entry_date")
    .eq("user_id", userId)
    .eq("source", "system")
    .like("description", "감가상각:%");

  const existingSet = new Set(
    (existingEntries || []).map((e) => `${e.description}:${e.entry_date}`)
  );

  const asOfMonth = asOfDate.substring(0, 7);
  let created = 0;

  for (const asset of assets as Asset[]) {
    const schedule = calculateDepreciationSchedule({
      acquisitionCost: asset.acquisition_cost,
      residualValue: asset.residual_value,
      usefulLifeMonths: asset.useful_life_months,
      acquisitionDate: asset.acquisition_date,
    });

    for (const entry of schedule) {
      if (entry.month > asOfMonth) break; // 미래는 건너뜀

      const dateStr = `${entry.month}-01`;
      const desc = `감가상각: ${asset.name}`;
      const key = `${desc}:${dateStr}`;

      if (existingSet.has(key)) continue;

      // Dr. 감가상각비 / Cr. 자산계정
      await supabase.rpc("create_journal_entry", {
        p_user_id: userId,
        p_entry_date: dateStr,
        p_effective_date: dateStr,
        p_description: desc,
        p_source: "system",
        p_tx_type: "expense",
        p_postings: [
          { account_id: depExpenseAccount.id, amount: entry.amount },
          { account_id: asset.account_id, amount: -entry.amount },
        ],
      });

      created++;
    }
  }

  return created;
}
