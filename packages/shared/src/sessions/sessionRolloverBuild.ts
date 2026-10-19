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
): { session: Session; ids: RolloverIdMaps; offsetDays: number } {
  const offsetDays = isoDayOffset(source.startDate, body.target.startDate);
  const ids: RolloverIdMaps = { classIds: new Map(), sectionIds: new Map() };
  const sessionId = newId();
  const classes = source.classes.map((cls) => {
    const classId = newId();
    ids.classIds.set(cls.id, classId);
    const sections = (cls.sections ?? [])
      .filter((section) => section.status === "active")
      .map((section) => {
        const sectionId = newId();
        ids.sectionIds.set(section.id, sectionId);
        return {
          id: sectionId,
          classId,
          name: section.name,
          capacity: section.capacity,
          room: section.room,
          status: "active" as const,
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
      fees: body.copy.fees ? cls.fees.map((fee) => ({ ...fee, id: newId(), classId })) : [],
      discounts: body.copy.discounts
        ? cls.discounts.map((discount) => ({
            ...discount,
            id: newId(),
            classId,
            startDate: shift(discount.startDate, offsetDays),
            endDate: shift(discount.endDate, offsetDays),
          }))
        : [],
      scholarships: body.copy.scholarships
        ? cls.scholarships.map((scholarship) => ({
            ...scholarship,
            id: newId(),
            classId,
            expiryDate: shift(scholarship.expiryDate, offsetDays),
          }))
        : [],
      schedules: [],
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
