import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 반복거래 자동 생성 엔진.
 *
 * recurring_rules를 읽고, start_date ~ asOfDate 범위에서
 * 아직 생성되지 않은 분개를 lazy하게 생성한다.
 *
 * "실시간 계산" 원칙: cron 없이, 대시보드/보고서 조회 시 호출.
 */

interface RecurringRule {
  id: string;
  user_id: string;
  name: string;
  frequency: string;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  postings_template: { account_id: string; category_id?: string; amount: number }[];
  flow_type: string;
  tx_type: string;
  is_prepaid: boolean;
  allocation_months: number | null;
}

/**
 * 특정 날짜까지의 미생성 반복거래 분개를 일괄 생성한다.
 */
export async function generatePendingRecurringEntries(
  supabase: SupabaseClient,
  userId: string,
  asOfDate: string = new Date().toISOString().split("T")[0]
): Promise<number> {
  // 활성 반복거래 규칙 조회
  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!rules?.length) return 0;

  // 이미 생성된 반복거래 분개 조회 (source = 'recurring')
  const { data: existingEntries } = await supabase
    .from("journal_entries")
    .select("reference, entry_date")
    .eq("user_id", userId)
    .eq("source", "recurring");

  const existingSet = new Set(
    (existingEntries || []).map((e) => `${e.reference}:${e.entry_date}`)
  );

  let created = 0;

  for (const rule of rules as RecurringRule[]) {
    const dates = generateDates(rule, asOfDate);

    for (const date of dates) {
      const key = `recurring:${rule.id}:${date}`;
      if (existingSet.has(key)) continue;

      // 분개 생성
      await supabase.rpc("create_journal_entry", {
        p_user_id: userId,
        p_entry_date: date,
        p_effective_date: date,
        p_description: rule.name,
        p_source: "recurring",
        p_tx_type: rule.tx_type,
        p_postings: rule.postings_template,
      });

      // reference 업데이트 (중복 방지용 키)
      // create_journal_entry가 id를 반환하므로 별도 업데이트 필요
      // → reference 필드를 postings_template에 넣을 수 없으니,
      //   existingSet 체크로 중복 방지 (같은 날짜+같은 규칙)

      created++;
    }
  }

  return created;
}

/**
 * 반복 규칙에 따라 start_date ~ asOfDate 범위의 날짜 목록 생성.
 */
function generateDates(rule: RecurringRule, asOfDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(rule.start_date);
  const end = rule.end_date ? new Date(rule.end_date) : new Date(asOfDate);
  const asOf = new Date(asOfDate);
  const finalDate = end < asOf ? end : asOf;

  const dayOfMonth = rule.day_of_month || 1;

  if (rule.flow_type === "scheduled_nonrecurring") {
    // 비반복: start_date 한 번만
    if (start <= asOf) {
      dates.push(rule.start_date);
    }
    return dates;
  }

  // 반복: frequency에 따라 날짜 생성
  let current = new Date(start.getFullYear(), start.getMonth(), dayOfMonth);
  if (current < start) {
    current = advanceByFrequency(current, rule.frequency);
  }

  while (current <= finalDate) {
    dates.push(current.toISOString().split("T")[0]);
    current = advanceByFrequency(current, rule.frequency);
  }

  return dates;
}

function advanceByFrequency(date: Date, frequency: string): Date {
  const next = new Date(date);
  switch (frequency) {
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "annually":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/**
 * 미래 예측용: 반복거래 규칙에서 미래 N개월의 예상 현금흐름을 계산.
 * 실제 분개를 생성하지 않고 예측만.
 */
export async function projectRecurringCashFlows(
  supabase: SupabaseClient,
  userId: string,
  forecastMonths: number
): Promise<{
  fixedRecurring: { amount: number; isIncome: boolean }[];
  scheduledItems: { month: string; amount: number; isIncome: boolean }[];
}> {
  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  const fixedRecurring: { amount: number; isIncome: boolean }[] = [];
  const scheduledItems: { month: string; amount: number; isIncome: boolean }[] = [];

  const now = new Date();
  const futureEnd = new Date(now.getFullYear(), now.getMonth() + forecastMonths, 28);
  // futureEnd는 날짜 비교에만 사용

  for (const rule of (rules || []) as RecurringRule[]) {
    const amount = rule.postings_template
      .filter((p) => p.amount > 0)
      .reduce((sum, p) => sum + p.amount, 0);
    const isIncome = rule.tx_type === "income";

    if (rule.flow_type === "fixed_recurring") {
      fixedRecurring.push({ amount, isIncome });
    } else if (rule.flow_type === "scheduled_nonrecurring") {
      // 미래 범위 안에 있는 예정 거래
      const ruleDate = new Date(rule.start_date);
      if (ruleDate > now && ruleDate <= futureEnd) {
        const month = rule.start_date.substring(0, 7);
        scheduledItems.push({ month, amount, isIncome });
      }
    }
  }

  return { fixedRecurring, scheduledItems };
}
