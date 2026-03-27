import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePendingRecurringEntries } from "@/lib/accounting/recurring";
import { generatePendingProvisionAccruals } from "@/lib/accounting/provisions";
import { generatePendingDepreciationEntries } from "@/lib/accounting/depreciation-sync";

/**
 * 발생주의 실시간 동기화 API.
 *
 * "마감 개념 없이 항상 최신 상태"를 구현하기 위해,
 * 대시보드/보고서 조회 시 이 API를 호출하여 미생성 분개를 일괄 생성한다:
 *
 * 1. 반복거래 → 미생성 분개 생성
 * 2. 준비금 적립 → 미생성 월별 적립 분개 생성
 * 3. 감가상각 → 미생성 월별 상각 분개 생성
 *
 * 이미 생성된 분개는 중복 생성하지 않음 (reference/date로 체크).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  const [recurringCount, provisionCount, depreciationCount] = await Promise.all([
    generatePendingRecurringEntries(supabase, user.id, today),
    generatePendingProvisionAccruals(supabase, user.id, today),
    generatePendingDepreciationEntries(supabase, user.id, today),
  ]);

  return NextResponse.json({
    synced: {
      recurring: recurringCount,
      provisions: provisionCount,
      depreciation: depreciationCount,
    },
    total: recurringCount + provisionCount + depreciationCount,
  });
}
