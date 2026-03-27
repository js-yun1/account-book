import { forecastWithEMA } from "./ema";
import { removeOutliersIQR } from "./outlier";

/**
 * 현금흐름 예측 엔진.
 *
 * 4가지 유형의 현금 유출입을 결합하여 미래 N개월 예상 잔액을 계산:
 * 1. 고정 반복: recurring_rules에서 확정 금액
 * 2. 변동 반복: 과거 데이터 EMA (이상치 제거 후)
 * 3. 예정 비반복: recurring_rules에서 단발 금액
 * 4. 불확실 발생: provisions 월 적립액을 지출로 반영 (보수적)
 */

export interface MonthlyProjection {
  month: string; // "YYYY-MM"
  income: number;
  expense: number;
  net: number;
  cumulativeBalance: number;
}

export interface ProjectionInput {
  currentBalance: number; // 현재 유동자산 잔액
  forecastMonths: number; // 6 or 12

  // 고정 반복 (수입 + 지출)
  fixedRecurring: { amount: number; isIncome: boolean }[];

  // 예정 비반복
  scheduledItems: { month: string; amount: number; isIncome: boolean }[];

  // 변동 반복: 과거 월별 데이터
  variableExpenseHistory: number[]; // 과거 월별 변동 지출 합계
  variableIncomeHistory: number[];  // 과거 월별 변동 수입 합계

  // 준비금 적립 (보수적 예측: 지출로 반영)
  monthlyProvisionTotal: number;
}

export function generateProjection(input: ProjectionInput): MonthlyProjection[] {
  const {
    currentBalance,
    forecastMonths,
    fixedRecurring,
    scheduledItems,
    variableExpenseHistory,
    variableIncomeHistory,
    monthlyProvisionTotal,
  } = input;

  // 고정 반복 월간 합계
  const fixedMonthlyIncome = fixedRecurring
    .filter((r) => r.isIncome)
    .reduce((sum, r) => sum + r.amount, 0);
  const fixedMonthlyExpense = fixedRecurring
    .filter((r) => !r.isIncome)
    .reduce((sum, r) => sum + r.amount, 0);

  // 변동 반복 예측 (EMA + 이상치 제거)
  const cleanedExpenses = removeOutliersIQR(variableExpenseHistory);
  const cleanedIncome = removeOutliersIQR(variableIncomeHistory);
  const forecastedVariableExpense = forecastWithEMA(cleanedExpenses);
  const forecastedVariableIncome = forecastWithEMA(cleanedIncome);

  // 미래 월 생성
  const now = new Date();
  const projections: MonthlyProjection[] = [];
  let balance = currentBalance;

  for (let i = 1; i <= forecastMonths; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = `${futureDate.getFullYear()}-${String(
      futureDate.getMonth() + 1
    ).padStart(2, "0")}`;

    // 해당 월의 예정 비반복
    const scheduledIncome = scheduledItems
      .filter((s) => s.month === month && s.isIncome)
      .reduce((sum, s) => sum + s.amount, 0);
    const scheduledExpense = scheduledItems
      .filter((s) => s.month === month && !s.isIncome)
      .reduce((sum, s) => sum + s.amount, 0);

    const totalIncome =
      fixedMonthlyIncome + forecastedVariableIncome + scheduledIncome;
    const totalExpense =
      fixedMonthlyExpense +
      forecastedVariableExpense +
      scheduledExpense +
      monthlyProvisionTotal; // 준비금을 지출로 반영 (보수적)

    const net = totalIncome - totalExpense;
    balance += net;

    projections.push({
      month,
      income: totalIncome,
      expense: totalExpense,
      net,
      cumulativeBalance: balance,
    });
  }

  return projections;
}
