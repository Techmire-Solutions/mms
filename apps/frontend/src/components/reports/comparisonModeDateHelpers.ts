export const COMPARISON_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function isInComparisonDateRange(dateStr: string, start: string, end: string): boolean {
  if (!dateStr) return false;
  return dateStr >= start && dateStr <= end;
}

export function getComparisonMonthIndex(dateStr: string): number {
  const parsedDate = new Date(dateStr);
  return Number.isNaN(parsedDate.getTime()) ? -1 : parsedDate.getMonth();
}
