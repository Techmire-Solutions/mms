import type { sessions, sessionFaculty, sessionClasses } from "./sessionCoreTables.js";
import type {
  sessionClassFees,
  sessionClassSchedules,
  sessionClassBudgets,
  sessionClassDiscounts,
  sessionClassTimetables,
  sessionClassTimetablePeriods,
  sessionClassRefreshments,
} from "./sessionClassSubTables.js";
import type {
  scholarshipEligibilities,
  sessionClassScholarships,
  sessionLookups,
  sessionFieldConfigs,
  sessionModulePreferences,
} from "./sessionSetupTables.js";

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */
export type SessionRow = typeof sessions.$inferSelect;
export type InsertSessionRow = typeof sessions.$inferInsert;
/** Session row as read by the app: `type` is derived from the program (migration 0181). */
export type SessionReadRow = typeof sessions.$inferSelect & { type: string };
export type SessionFacultyRow = typeof sessionFaculty.$inferSelect;
export type InsertSessionFacultyRow = typeof sessionFaculty.$inferInsert;
export type SessionClassRow = typeof sessionClasses.$inferSelect;
export type InsertSessionClassRow = typeof sessionClasses.$inferInsert;
export type SessionClassFeeRow = typeof sessionClassFees.$inferSelect;
export type InsertSessionClassFeeRow = typeof sessionClassFees.$inferInsert;
export type SessionClassScheduleRow = typeof sessionClassSchedules.$inferSelect;
export type InsertSessionClassScheduleRow = typeof sessionClassSchedules.$inferInsert;
export type SessionClassBudgetRow = typeof sessionClassBudgets.$inferSelect;
export type InsertSessionClassBudgetRow = typeof sessionClassBudgets.$inferInsert;
export type SessionClassDiscountRow = typeof sessionClassDiscounts.$inferSelect;
export type InsertSessionClassDiscountRow = typeof sessionClassDiscounts.$inferInsert;
export type SessionClassTimetableRow = typeof sessionClassTimetables.$inferSelect;
export type InsertSessionClassTimetableRow = typeof sessionClassTimetables.$inferInsert;
export type SessionClassTimetablePeriodRow = typeof sessionClassTimetablePeriods.$inferSelect;
export type InsertSessionClassTimetablePeriodRow = typeof sessionClassTimetablePeriods.$inferInsert;
export type SessionClassRefreshmentRow = typeof sessionClassRefreshments.$inferSelect;
export type InsertSessionClassRefreshmentRow = typeof sessionClassRefreshments.$inferInsert;
export type ScholarshipEligibilityRow = typeof scholarshipEligibilities.$inferSelect;
export type InsertScholarshipEligibilityRow = typeof scholarshipEligibilities.$inferInsert;
export type SessionClassScholarshipRow = typeof sessionClassScholarships.$inferSelect;
export type InsertSessionClassScholarshipRow = typeof sessionClassScholarships.$inferInsert;
export type SessionLookupsRow = typeof sessionLookups.$inferSelect;
export type InsertSessionLookupsRow = typeof sessionLookups.$inferInsert;
export type SessionFieldConfigsRow = typeof sessionFieldConfigs.$inferSelect;
export type InsertSessionFieldConfigsRow = typeof sessionFieldConfigs.$inferInsert;
export type SessionModulePreferencesRow = typeof sessionModulePreferences.$inferSelect;
export type InsertSessionModulePreferencesRow = typeof sessionModulePreferences.$inferInsert;
