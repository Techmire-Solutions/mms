import type { AcademicCalendarEvent, AcademicCalendarScope } from "./academicCalendarTypes.js";

/** Weekday names indexed like `Date#getUTCDay()` (0 = Sunday). */
export const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

/** Calendar event fields the instructional-day rules need. */
export type CalendarEventLite = Pick<
  AcademicCalendarEvent,
  "kind" | "startOn" | "endOn" | "scope" | "sessionId" | "classId" | "sectionId"
> & {
  title?: string;
};

export interface InstructionalDayContext {
  /** Weekly working days (0 = Sunday); a session override replaces the workspace default. */
  workingWeekdays: readonly number[];
  /** Active calendar events (any scope); only those applying to `scope` are considered. */
  events: readonly CalendarEventLite[];
  scope?: { sessionId?: string | null; classId?: string | null; sectionId?: string | null };
}

export interface InstructionalDayDecision {
  instructional: boolean;
  /** The holiday / make-up day that decided it (absent when the weekly pattern decided). */
  event?: CalendarEventLite;
}

const SCOPE_RANK: Record<AcademicCalendarScope, number> = {
  section: 0,
  class: 1,
  session: 2,
  workspace: 3,
};

/** Maps weekday names (any case) to `getUTCDay()` indexes, ignoring unknown names. */
export function weekdayIndexes(names: readonly string[]): number[] {
  const indexes = names
    .map((name) => (WEEKDAY_NAMES as readonly string[]).indexOf(name.trim().toLowerCase()))
    .filter((index) => index >= 0);
  return [...new Set(indexes)].sort((a, b) => a - b);
}

/** Weekday of a `YYYY-MM-DD` calendar date (computed in UTC, so DST never shifts it). */
export function isoWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Adds whole calendar days to a `YYYY-MM-DD` date. */
export function addIsoDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function appliesTo(event: CalendarEventLite, scope: InstructionalDayContext["scope"]): boolean {
  switch (event.scope) {
    case "workspace":
      return true;
    case "session":
      return Boolean(event.sessionId) && event.sessionId === scope?.sessionId;
    case "class":
      return Boolean(event.classId) && event.classId === scope?.classId;
    case "section":
      return Boolean(event.sectionId) && event.sectionId === scope?.sectionId;
  }
}

/**
 * Decides whether a date is a teaching day. Holidays and make-up days override the weekly
 * pattern; the narrowest applicable scope wins, and a holiday beats a make-up day at the same scope.
 * Exam periods and general events do not change instructional status.
 */
export function instructionalDayDecision(
  date: string,
  ctx: InstructionalDayContext,
): InstructionalDayDecision {
  const decisive = ctx.events
    .filter(
      (event) =>
        (event.kind === "holiday" || event.kind === "makeup_day") &&
        event.startOn <= date &&
        date <= event.endOn &&
        appliesTo(event, ctx.scope),
    )
    .sort(
      (a, b) =>
        SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope] ||
        (a.kind === "holiday" ? -1 : 0) - (b.kind === "holiday" ? -1 : 0),
    )[0];
  if (decisive) return { instructional: decisive.kind === "makeup_day", event: decisive };
  return { instructional: ctx.workingWeekdays.includes(isoWeekday(date)) };
}

export function isInstructionalDay(date: string, ctx: InstructionalDayContext): boolean {
  return instructionalDayDecision(date, ctx).instructional;
}

/** Teaching days in an inclusive `YYYY-MM-DD` range (bounded to 3 years). */
export function listInstructionalDays(
  from: string,
  to: string,
  ctx: InstructionalDayContext,
): string[] {
  const days: string[] = [];
  for (
    let date = from, guard = 0;
    date <= to && guard < 1100;
    date = addIsoDays(date, 1), guard += 1
  ) {
    if (isInstructionalDay(date, ctx)) days.push(date);
  }
  return days;
}
