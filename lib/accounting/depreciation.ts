/**
 * 정액법 감가상각 계산.
 *
 * Rounding 정책: 매월 floor(총액 / 개월수), 마지막 월에 잔여액 일괄 조정.
 * 등록 월은 전액 상각 (일할 계산 안 함).
 */

export interface DepreciationSchedule {
  month: string; // "YYYY-MM"
  amount: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

export interface DepreciationParams {
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  acquisitionDate: string; // "YYYY-MM-DD"
}

/**
 * 전체 감가상각 스케줄을 생성한다.
 */
export function calculateDepreciationSchedule(
  params: DepreciationParams
): DepreciationSchedule[] {
  const { acquisitionCost, residualValue, usefulLifeMonths, acquisitionDate } =
    params;

  const depreciableAmount = acquisitionCost - residualValue;
  if (depreciableAmount <= 0 || usefulLifeMonths <= 0) return [];

  const monthlyAmount = Math.floor(depreciableAmount / usefulLifeMonths);
  const lastMonthAmount =
    depreciableAmount - monthlyAmount * (usefulLifeMonths - 1);

  const schedule: DepreciationSchedule[] = [];
  let accumulated = 0;

  const startDate = new Date(acquisitionDate);
  let year = startDate.getFullYear();
  let month = startDate.getMonth(); // 0-indexed

  for (let i = 0; i < usefulLifeMonths; i++) {
    const isLast = i === usefulLifeMonths - 1;
    const amount = isLast ? lastMonthAmount : monthlyAmount;
    accumulated += amount;

    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    schedule.push({
      month: monthStr,
      amount,
      accumulatedDepreciation: accumulated,
      bookValue: acquisitionCost - accumulated,
    });

    // 다음 월로 이동
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return schedule;
}

/**
 * 특정 월까지의 누적 감가상각비를 계산한다.
 */
export function getDepreciationAsOf(
  params: DepreciationParams,
  asOfMonth: string // "YYYY-MM"
): { monthlyAmount: number; accumulated: number; bookValue: number } {
  const schedule = calculateDepreciationSchedule(params);
  const entries = schedule.filter((s) => s.month <= asOfMonth);

  if (entries.length === 0) {
    return {
      monthlyAmount: 0,
      accumulated: 0,
      bookValue: params.acquisitionCost,
    };
  }

  const last = entries[entries.length - 1];
  return {
    monthlyAmount: last.amount,
    accumulated: last.accumulatedDepreciation,
    bookValue: last.bookValue,
  };
}
