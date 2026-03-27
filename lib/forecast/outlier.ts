/**
 * IQR (사분위 범위) 기반 이상치 제거.
 *
 * 지출 데이터는 보통 right-skewed(큰 지출이 간헐적) 이므로
 * 정규분포를 가정하는 Z-Score보다 IQR이 더 robust.
 */

export function removeOutliersIQR(
  values: number[],
  factor: number = 1.5
): number[] {
  if (values.length < 4) return values;

  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const lower = q1 - factor * iqr;
  const upper = q3 + factor * iqr;

  return values.filter((v) => v >= lower && v <= upper);
}
