const formatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export function formatKRW(amount: number): string {
  return formatter.format(amount);
}

/**
 * 부호에 따라 + / - 접두사 포함한 포맷.
 * 양수: +₩1,000, 음수: -₩1,000, 0: ₩0
 */
export function formatKRWSigned(amount: number): string {
  if (amount > 0) return `+${formatter.format(amount)}`;
  return formatter.format(amount);
}
