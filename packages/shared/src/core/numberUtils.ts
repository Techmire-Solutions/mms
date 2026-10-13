/** Safely calculates a rounded percentage integer. */
export function calcPercentage(value: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((value / total) * 100);
}

/** Safely calculates percent change between current and previous values. */
export function calcPercentChange(current: number, previous: number): number {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  return current > 0 ? 100 : 0;
}
