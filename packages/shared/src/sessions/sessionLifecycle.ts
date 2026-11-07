import type { Session } from "./sessionTypes.js";
import { isSessionReadOnly, isSessionStructureLocked } from "./sessionTransitions.js";

/**
 * Session lifecycle rules that operate on a full session aggregate (the edit lock). The state
 * machine itself lives in `sessionTransitions.ts`; these exports are kept here so existing
 * `@mms/shared` consumers (`isSessionStructureLocked`, `jump` guards) do not change imports.
 */
export {
  SESSION_ENROLLABLE_STATES,
  SESSION_LIFECYCLE_STATES,
  SESSION_OVERLAP_STATES,
  SESSION_PHASES,
  SESSION_TRANSITIONS,
  SESSION_TRANSITION_VIOLATIONS,
  canTransitionSession,
  deriveSessionPhase,
  evaluateSessionTransition,
  InvalidSessionStatusError,
  isSessionEnrollable,
  isSessionReadOnly,
  isSessionStructureLocked,
  isTransitionFullyOverridable,
  normalizeSessionStatus,
  parseSessionStatus,
  sessionStatusSchema,
  type SessionLifecycleState,
  type SessionStatus,
  type SessionPhase,
  type SessionPhaseEvent,
  type SessionTransitionContext,
  type SessionTransitionEvaluation,
  type SessionTransitionViolation,
} from "./sessionTransitions.js";

export { normalizeSessionStatusFilter, sessionStatusFilterSchema } from "./sessionStatusFilter.js";

/** Edit-policy violation codes (translated by the UI as `sessions.lock.field.{code}`). */
export type SessionEditViolation =
  | "readOnly"
  | "startDate"
  | "endDate"
  | "category"
  | "program"
  | "classRemoved"
  | "sectionRemoved"
  | "eligibility"
  | "capacityBelowEnrolled"
  | "criteria"
  | "pastTimetable";

/**
 * Edit policy for a started session (same rules on client and server):
 * - completed / cancelled / archived: read-only;
 * - in progress: no change to start date, category or program; no removing classes or sections;
 *   no changing a class's age/gender eligibility; no capacity below current enrollment; no shrinking
 *   the end date below the current day or below a recorded timetable; no changing completion
 *   criteria or the session fee (they alter historical results/metrics).
 * - in progress, with `today`: no editing or removing a timetable dated before today (history of
 *   who taught what), today and later stay editable.
 * Adding classes/sections, extending the end date, raising capacity and staff edits stay allowed.
 */
export function findSessionEditViolations(
  before: Session,
  after: Session,
  today?: string,
): SessionEditViolation[] {
  if (isSessionReadOnly(before.status)) {
    return JSON.stringify(editableProjection(before)) === JSON.stringify(editableProjection(after))
      ? []
      : ["readOnly"];
  }
  if (!isSessionStructureLocked(before.status)) return [];

  const violations = new Set<SessionEditViolation>();
  if ((before.startDate ?? "") !== (after.startDate ?? "")) violations.add("startDate");
  if ((before.categoryId ?? "") !== (after.categoryId ?? "")) violations.add("category");
  if ((before.programId ?? "") !== (after.programId ?? "")) violations.add("program");
  if (completionCriteriaChanged(before, after)) violations.add("criteria");
  if (endDateShrinks(before, after, today)) violations.add("endDate");

  const afterClasses = new Map((after.classes ?? []).map((cls) => [cls.id, cls]));
  for (const cls of before.classes ?? []) {
    const next = afterClasses.get(cls.id);
    if (!next) {
      violations.add("classRemoved");
      continue;
    }
    if (cls.gender !== next.gender || cls.minAge !== next.minAge || cls.maxAge !== next.maxAge)
      violations.add("eligibility");
    if (today && pastTimetablesChanged(cls.timetables ?? [], next.timetables ?? [], today))
      violations.add("pastTimetable");
    if (next.sections !== undefined) {
      const nextSections = new Map(next.sections.map((section) => [section.id, section]));
      for (const section of cls.sections ?? []) {
        const updated = nextSections.get(section.id);
        if (!updated) violations.add("sectionRemoved");
        else if ((updated.capacity ?? 0) < (section.enrolled ?? 0))
          violations.add("capacityBelowEnrolled");
      }
    } else if ((next.maxStudents ?? 0) < (cls.enrolled ?? 0)) {
      violations.add("capacityBelowEnrolled");
    }
  }
  return [...violations];
}

/**
 * End-date rule for a started session: extending is always allowed; shrinking below the current
 * business day or below a date that already carries recorded teaching is not. The caller adds the
 * attendance / enrollment bounds it can read from the store ({@link endDateBoundViolations}).
 */
function endDateShrinks(before: Session, after: Session, today?: string): boolean {
  const previous = (before.endDate ?? "").slice(0, 10);
  const next = (after.endDate ?? "").slice(0, 10);
  if (!previous || !next || next >= previous) return false;
  const day = (today ?? "").slice(0, 10);
  if (day && next < day) return true;
  return (before.classes ?? []).some((cls) =>
    (cls.timetables ?? []).some((timetable) => {
      const date = (timetable.date ?? "").slice(0, 10);
      return Boolean(date) && next < date;
    }),
  );
}

/** Fee + grading policy are historical inputs: changing them after start needs an override. */
function completionCriteriaChanged(before: Session, after: Session): boolean {
  if ((before.minAttendancePct ?? null) !== (after.minAttendancePct ?? null)) return true;
  if (Boolean(before.requiresExamPass) !== Boolean(after.requiresExamPass)) return true;
  if (Number(before.baseFee ?? 0) !== Number(after.baseFee ?? 0)) return true;
  const days = (session: Session) => [...(session.workingDays ?? [])].sort().join(",");
  return days(before) !== days(after);
}

/**
 * Store-backed end-date bounds: recorded attendance and live enrollments may not end up outside the
 * session after a shrink. Returns the violation codes for the edit-lock error.
 */
export function endDateBoundViolations(input: {
  previousEndDate?: string | null;
  nextEndDate?: string | null;
  lastAttendanceDate?: string | null;
  lastEnrollmentEnd?: string | null;
  today?: string;
}): SessionEditViolation[] {
  const previous = (input.previousEndDate ?? "").slice(0, 10);
  const next = (input.nextEndDate ?? "").slice(0, 10);
  if (!previous || !next || next >= previous) return [];
  const bounds = [
    (input.today ?? "").slice(0, 10),
    (input.lastAttendanceDate ?? "").slice(0, 10),
    (input.lastEnrollmentEnd ?? "").slice(0, 10),
  ].filter(Boolean);
  return bounds.some((bound) => next < bound) ? ["endDate"] : [];
}

type Timetable = NonNullable<Session["classes"]>[number]["timetables"][number];

const timetableKey = (timetable: Timetable) =>
  JSON.stringify(
    timetable.periods.map((period) => [
      period.startTime,
      period.endTime,
      period.subject,
      period.subjectId ?? "",
      period.facultyId ?? "",
      [...(period.assistantFacultyIds ?? [])].sort(),
    ]),
  );

/** A timetable dated before `today` was removed or its periods changed. */
function pastTimetablesChanged(
  before: readonly Timetable[],
  after: readonly Timetable[],
  today: string,
): boolean {
  const next = new Map(after.map((timetable) => [timetable.id, timetable]));
  return before.some((timetable) => {
    if (!timetable.date || timetable.date.slice(0, 10) >= today) return false;
    const updated = next.get(timetable.id);
    return (
      !updated ||
      updated.date.slice(0, 10) !== timetable.date.slice(0, 10) ||
      timetableKey(updated) !== timetableKey(timetable)
    );
  });
}

const byId = <T extends { id: string }>(rows: readonly T[] | undefined): T[] =>
  [...(rows ?? [])].sort((left, right) => left.id.localeCompare(right.id));

/**
 * User-editable content only. Derived values (`enrolled`, `facultyName`, catalog-refreshed
 * subject names) are excluded so a read-only session is not flagged by hydration alone, while
 * every field a user can actually change is included — otherwise a completed/cancelled session
 * could still be rewritten through the fields that were missed.
 */
function editableProjection(session: Session) {
  return {
    name: session.name,
    type: session.type ?? "",
    startDate: session.startDate ?? "",
    endDate: session.endDate ?? "",
    categoryId: session.categoryId ?? "",
    programId: session.programId ?? "",
    baseFee: Number(session.baseFee ?? 0),
    currency: session.currency ?? "",
    description: session.description ?? "",
    minAttendancePct: session.minAttendancePct ?? null,
    requiresExamPass: Boolean(session.requiresExamPass),
    workingDays: [...(session.workingDays ?? [])].sort(),
    faculty: byId(session.faculty).map((member) => [
      member.id,
      member.facultyId,
      member.role,
      member.status,
    ]),
    classes: (session.classes ?? []).map((cls) => ({
      id: cls.id,
      name: cls.name,
      gender: cls.gender,
      minAge: cls.minAge,
      maxAge: cls.maxAge,
      programId: cls.programId ?? "",
      facultyId: cls.facultyId ?? "",
      room: cls.room ?? "",
      status: cls.status,
      enrollmentDeadline: cls.enrollmentDeadline ?? "",
      maxStudents: cls.maxStudents ?? 0,
      fees: byId(cls.fees).map((fee) => [fee.id, fee.feeType, Number(fee.amount)]),
      schedules: byId(cls.schedules).map((schedule) => [
        schedule.id,
        schedule.scheduleType,
        schedule.startDate,
        schedule.endDate,
      ]),
      budgets: byId(cls.budgets).map((budget) => [
        budget.id,
        budget.budgetType,
        budget.detail,
        Number(budget.amount),
      ]),
      discounts: byId(cls.discounts).map((discount) => [
        discount.id,
        discount.discountType,
        Number(discount.percentage),
        discount.startDate,
        discount.endDate,
        discount.status,
      ]),
      timetables: byId(cls.timetables).map((timetable) => [
        timetable.id,
        timetable.date.slice(0, 10),
        timetableKey(timetable),
      ]),
      refreshments: byId(cls.refreshments).map((refreshment) => [
        refreshment.id,
        refreshment.date,
        refreshment.item,
        refreshment.quantity,
        Number(refreshment.pricePerUnit),
        Number(refreshment.paidAmount),
      ]),
      scholarships: byId(cls.scholarships).map((scholarship) => [
        scholarship.id,
        Number(scholarship.percentage),
        scholarship.expiryDate,
        scholarship.scholarshipEligibilityId ?? "",
        scholarship.eligibility?.id ?? "",
      ]),
      sections: (cls.sections ?? []).map((section) => [
        section.id,
        section.name,
        section.capacity,
        section.room ?? "",
        section.status,
      ]),
    })),
  };
}
