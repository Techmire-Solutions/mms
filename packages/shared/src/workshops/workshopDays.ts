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

/**
 * Inclusive number of calendar days the workshop runs, optionally capped at `until` (the workspace
 * business day). Arithmetic in UTC and **uncapped** — this is the denominator for completion
 * percentages, where truncating at {@link WORKSHOP_MAX_DAYS} would let a long workshop report more
 * present days than there are days (a numerator/denominator mismatch).
 *
 * Returns 0 when there is no start date, either date is unparsable, the end precedes the start, or
 * `until` is before the start.
 */
export function countWorkshopDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  until?: string | null,
): number {
  if (!startDate) return 0;
  const start = toUtcDay(startDate.slice(0, 10));
  const rawEnd = toUtcDay((endDate ?? startDate).slice(0, 10));
  if (start === null || rawEnd === null || rawEnd < start) return 0;
  const cap = until ? toUtcDay(until.slice(0, 10)) : null;
  const end = cap !== null && cap < rawEnd ? cap : rawEnd;
  if (end < start) return 0;
  return Math.floor((end - start) / DAY_MS) + 1;
}
