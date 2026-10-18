import {
  ClassSchema,
  SessionFacultySchema,
  SessionClassFeeSchema,
  SessionClassScheduleSchema,
  SessionClassBudgetSchema,
  SessionClassDiscountSchema,
  SessionClassTimetableSchema,
  SessionClassTimetablePeriodSchema,
  SessionClassRefreshmentSchema,
  ScholarshipEligibilitySchema,
  SessionClassScholarshipSchema,
  SessionSchema,
  type Class,
  type SessionFaculty,
  type SessionClassFee,
  type SessionClassSchedule,
  type SessionClassBudget,
  type SessionClassDiscount,
  type SessionClassTimetable,
  type SessionClassTimetablePeriod,
  type SessionClassRefreshment,
  type ScholarshipEligibility,
  type SessionClassScholarship,
  type Session,
} from "@mms/shared";

export {
  ClassSchema,
  SessionFacultySchema,
  SessionClassFeeSchema,
  SessionClassScheduleSchema,
  SessionClassBudgetSchema,
  SessionClassDiscountSchema,
  SessionClassTimetableSchema,
  SessionClassTimetablePeriodSchema,
  SessionClassRefreshmentSchema,
  ScholarshipEligibilitySchema,
  SessionClassScholarshipSchema,
  SessionSchema,
};

export type {
  Class,
  SessionFaculty,
  SessionClassFee,
  SessionClassSchedule,
  SessionClassBudget,
  SessionClassDiscount,
  SessionClassTimetable,
  SessionClassTimetablePeriod,
  SessionClassRefreshment,
  ScholarshipEligibility,
  SessionClassScholarship,
  Session,
};

export function validateSessions(sessionInput: unknown): Session[] {
  if (!Array.isArray(sessionInput)) return [];
  const valid: Session[] = [];
  for (const item of sessionInput) {
    const parsed = SessionSchema.safeParse(item);
    if (parsed.success) valid.push(parsed.data);
  }
  return valid;
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
