/**
 * 선불비용(Prepaid Expense) 월할 배분 계산.
 *
 * 예: 연간 보험료 120만원을 1월에 납부 → 매월 10만원씩 12개월 비용 처리.
 * Rounding 정책: floor + 마지막 월 잔여액 조정.
 */

export interface AllocationSchedule {
  month: string; // "YYYY-MM"
  amount: number;
  remainingPrepaid: number;
}

export interface PrepaidExpenseParams {
  totalAmount: number;
  allocationMonths: number;
  startDate: string; // "YYYY-MM-DD"
}

/**
 * 선불비용의 월별 배분 스케줄을 생성한다.
 */
export function calculatePrepaidAllocation(
  params: PrepaidExpenseParams
): AllocationSchedule[] {
  const { totalAmount, allocationMonths, startDate } = params;

  if (totalAmount <= 0 || allocationMonths <= 0) return [];

  const monthlyAmount = Math.floor(totalAmount / allocationMonths);
  const lastMonthAmount =
    totalAmount - monthlyAmount * (allocationMonths - 1);

  const schedule: AllocationSchedule[] = [];
  let remaining = totalAmount;

  const start = new Date(startDate);
  let year = start.getFullYear();
  let month = start.getMonth();

  for (let i = 0; i < allocationMonths; i++) {
    const isLast = i === allocationMonths - 1;
    const amount = isLast ? lastMonthAmount : monthlyAmount;
    remaining -= amount;

    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    schedule.push({
      month: monthStr,
      amount,
      remainingPrepaid: remaining,
    });

    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return schedule;
}
