/**
 * 지수가중이동평균 (Exponential Moving Average).
 *
 * EMA_t = α × Y_t + (1 - α) × EMA_{t-1}
 * α = 2 / (periods + 1)
 *
 * 최근 데이터에 더 큰 가중치를 주어 지출 패턴 변화를 빠르게 반영.
 */

export function calculateEMA(values: number[], periods: number = 3): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [values[0]];

  const alpha = 2 / (periods + 1);
  const ema: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    ema[i] = alpha * values[i] + (1 - alpha) * ema[i - 1];
  }

  return ema;
}

/**
 * EMA 기반 미래 예측값.
 * 단순 EMA는 트렌드를 포함하지 않으므로 마지막 EMA 값을 반복.
 */
export function forecastWithEMA(
  values: number[],
  periods: number = 3
): number {
  if (values.length === 0) return 0;
  if (values.length < 3) {
    // 데이터 부족 시 단순 평균
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  const ema = calculateEMA(values, periods);
  return Math.round(ema[ema.length - 1]);
}
