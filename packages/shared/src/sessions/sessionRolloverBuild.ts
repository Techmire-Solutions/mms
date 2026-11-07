import { addIsoDays } from "../attendance/academicCalendar.js";
import type { SessionRolloverBody } from "./sessionRollover.js";
import type { Session } from "./sessionTypes.js";

/** Whole calendar days from one `YYYY-MM-DD` date to another (0 when either is missing). */
export function isoDayOffset(
  from: string | null | undefined,
  to: string | null | undefined,
): number {
  const start = from?.slice(0, 10);
  const end = to?.slice(0, 10);
  if (!start || !end) return 0;
  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  );
}

function shift(value: string | undefined, days: number): string {
  const day = value?.slice(0, 10);
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? addIsoDays(day, days) : (value ?? "");
}

/**
 * Deterministic id factory used by the job: `(kind, sourceId) => stable id`. A retried rollover
 * re-uses the same ids, so `saveSession`/`bulkSaveEnrollments` upserts instead of duplicating.
 */
export type RolloverIdFactory = (kind: string, sourceId: string) => string;

export interface RolloverIdMaps {
  /** Source class id → copied class id. */
  classIds: Map<string, string>;
  /** Source section id → copied section id. */
  sectionIds: Map<string, string>;
}

/**
 * Draft copy of a session for a rollover: classes and sections with new ids, fees / discounts /
 * scholarships per the copy flags, dated fields shifted by the start-date offset. Operational
 * data (schedules, budgets, timetables, refreshments, session staff) is never copied.
 */
export function buildRolloverSession(
  source: Session,
  body: Pick<SessionRolloverBody, "target" | "copy">,
  newId: () => string,
  deterministicId?: RolloverIdFactory,
): { session: Session; ids: RolloverIdMaps; offsetDays: number } {
  const idFor = (kind: string, sourceId?: string) =>
    deterministicId && sourceId ? deterministicId(kind, sourceId) : newId();
  const offsetDays = isoDayOffset(source.startDate, body.target.startDate);
  const ids: RolloverIdMaps = { classIds: new Map(), sectionIds: new Map() };
  const sessionId = idFor("session", source.id);
  const classes = source.classes.map((cls) => {
    const classId = idFor("class", cls.id);
    ids.classIds.set(cls.id, classId);
    // Every section is copied with its status preserved: dropping closed sections silently
    // shrinks the inherited quota (review finding R8).
    const sections = (cls.sections ?? []).map((section) => {
      const sectionId = idFor("section", section.id);
      ids.sectionIds.set(section.id, sectionId);
      return {
        id: sectionId,
        classId,
        name: section.name,
        capacity: section.capacity,
        room: section.room,
        status: section.status ?? "active",
      };
    });
    return {
      ...cls,
      id: classId,
      sessionId,
      enrolled: 0,
      ageCalculationDate: shift(cls.ageCalculationDate, offsetDays),
      enrollmentDeadline: shift(cls.enrollmentDeadline, offsetDays),
      sections,
      fees: body.copy.fees
        ? cls.fees.map((fee) => ({ ...fee, id: idFor("fee", fee.id), classId }))
        : [],
      discounts: body.copy.discounts
        ? cls.discounts.map((discount) => ({
            ...discount,
            id: idFor("discount", discount.id),
            classId,
            startDate: shift(discount.startDate, offsetDays),
            endDate: shift(discount.endDate, offsetDays),
          }))
        : [],
      scholarships: body.copy.scholarships
        ? cls.scholarships.map((scholarship) => {
            // A copied scholarship gets its own eligibility row; sharing the source row let an
            // edit in the new session rewrite the previous session's eligibility (finding R12).
            const eligibilityId = scholarship.eligibility
              ? idFor("eligibility", scholarship.eligibility.id)
              : undefined;
            return {
              ...scholarship,
              id: idFor("scholarship", scholarship.id),
              classId,
              expiryDate: shift(scholarship.expiryDate, offsetDays),
              ...(eligibilityId
                ? {
                    scholarshipEligibilityId: eligibilityId,
                    eligibility: { ...scholarship.eligibility!, id: eligibilityId },
                  }
                : {}),
            };
          })
        : [],
      schedules: body.copy.schedules
        ? cls.schedules.map((schedule) => ({
            ...schedule,
            id: idFor("schedule", schedule.id),
            classId,
            startDate: shift(schedule.startDate, offsetDays),
            endDate: shift(schedule.endDate, offsetDays),
          }))
        : [],
      budgets: [],
      timetables: [],
      refreshments: [],
    };
  });
  const session: Session = {
    id: sessionId,
    name: body.target.name,
    status: "draft",
    type: source.type,
    categoryId: body.target.categoryId ?? source.categoryId,
    programId: source.programId,
    startDate: body.target.startDate,
    endDate: body.target.endDate,
    workingDays: body.copy.workingDays ? source.workingDays : undefined,
    description: source.description,
    currency: source.currency,
    baseFee: source.baseFee,
    faculty: [],
    classes,
  };
  return { session, ids, offsetDays };
}
