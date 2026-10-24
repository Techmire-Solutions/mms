/** Longest run of days listed for one workshop; longer events are better modelled as sessions. */
export const WORKSHOP_MAX_DAYS = 62;

const DAY_MS = 86_400_000;

function toUtcDay(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(time) ? null : time;
}

/**
 * Calendar days (`YYYY-MM-DD`) a workshop runs, inclusive of both ends. A missing end means a
 * one-day workshop; no start, an unparsable date or an end before the start yields `[]`. The
 * list is capped at {@link WORKSHOP_MAX_DAYS}. Arithmetic is in UTC, so it is timezone-free.
 */
export function listWorkshopDays(startDate: string | null, endDate: string | null): string[] {
  if (!startDate) return [];
  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate ?? startDate);
  if (start === null || end === null || end < start) return [];
  const days: string[] = [];
  for (let time = start; time <= end && days.length < WORKSHOP_MAX_DAYS; time += DAY_MS) {
    days.push(new Date(time).toISOString().slice(0, 10));
  }
  return days;
}
