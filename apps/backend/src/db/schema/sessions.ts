import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  boolean,
  jsonb,
  primaryKey,
  foreignKey,
  varchar,
  numeric,
  date,
  smallint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { faculty } from "./faculty.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { sessionCategories, programs, subjects } from "./academicCatalogs.js";

/**
 * Academic Sessions entity rows (Model 6).
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    /** Session Category (Academic Year, Term, Short Course, …) — `session_categories`. */
    categoryId: text("category_id"),
    /** Optional default Program for the session's classes — `programs`. */
    programId: text("program_id"),
    /** Lifecycle state (draft | open | in_progress | completed | cancelled | archived) — see sessionLifecycle. */
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    baseFee: numeric("base_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 20 }).notNull().default("PKR"),
    description: text("description"),
    /** Short-course completion criteria (migration 0178). */
    minAttendancePct: smallint("min_attendance_pct"),
    requiresExamPass: boolean("requires_exam_pass").notNull().default(false),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "sessions_category_fk",
      columns: [table.workspaceSubdomain, table.categoryId],
      foreignColumns: [sessionCategories.workspaceSubdomain, sessionCategories.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "sessions_program_fk",
      columns: [table.workspaceSubdomain, table.programId],
      foreignColumns: [programs.workspaceSubdomain, programs.id],
    }).onDelete("restrict"),
    index("sessions_workspace_category_idx").on(table.workspaceSubdomain, table.categoryId),
    index("sessions_workspace_program_idx").on(table.workspaceSubdomain, table.programId),
    index("sessions_workspace_name_idx").on(table.workspaceSubdomain, table.name),
    index("sessions_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    index("sessions_workspace_start_date_idx").on(table.workspaceSubdomain, table.startDate),
    index("sessions_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("sessions_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("sessions_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

/**
 * Session Management / Faculty assigned to session (Model 6).
 */
export const sessionFaculty = pgTable(
  "session_faculty",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    facultyId: text("faculty_id").notNull(),
    facultyName: varchar("faculty_name", { length: 255 }).notNull().default(""),
    role: varchar("role", { length: 100 }).notNull().default("coordinator"),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.facultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("restrict"),
    index("session_faculty_workspace_session_idx").on(table.workspaceSubdomain, table.sessionId),
    index("session_faculty_workspace_faculty_idx").on(table.workspaceSubdomain, table.facultyId),
  ],
);

/**
 * Session Classes (Model 6).
 */
export const sessionClasses = pgTable(
  "session_classes",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    gender: varchar("gender", { length: 20 }).notNull().default("mixed"),
    ageCalculationDate: date("age_calc_date", { mode: "string" }),
    ageMin: integer("age_min").notNull().default(4),
    ageMax: integer("age_max").notNull().default(25),
    capacity: integer("capacity").notNull().default(30), // Max Student Count
    enrolled: integer("enrolled").notNull().default(0),
    enrollmentDeadline: varchar("enrollment_deadline", { length: 35 }).notNull().default(""),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    facultyId: text("faculty_id"),
    facultyName: varchar("faculty_name", { length: 255 }).default(""),
    room: varchar("room", { length: 100 }).default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    programId: text("program_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionId, table.id] }),
    foreignKey({
      name: "session_classes_program_fk",
      columns: [table.workspaceSubdomain, table.programId],
      foreignColumns: [programs.workspaceSubdomain, programs.id],
    }).onDelete("restrict"),
    index("session_classes_workspace_program_idx").on(table.workspaceSubdomain, table.programId),
    foreignKey({
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.facultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("restrict"),
    uniqueIndex("session_classes_ws_id_uidx").on(table.workspaceSubdomain, table.id),
    index("session_classes_workspace_session_idx").on(table.workspaceSubdomain, table.sessionId),
    index("session_classes_workspace_faculty_idx").on(table.workspaceSubdomain, table.facultyId),
    uniqueIndex("session_classes_workspace_session_name_uidx").on(
      table.workspaceSubdomain,
      table.sessionId,
      sql`lower(btrim(regexp_replace(${table.name}, '[[:space:]]+', ' ', 'g')))`,
    ),
  ],
);

/**
 * Session Class Fees (Model 6).
 */
export const sessionClassFees = pgTable(
  "session_class_fees",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionClassId: text("session_class_id").notNull(),
    feeType: varchar("fee_type", { length: 100 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionClassId, table.id] }),
    index("session_class_fees_workspace_class_idx").on(
      table.workspaceSubdomain,
      table.sessionClassId,
    ),
    foreignKey({
      name: "session_class_fees_class_fk",
      columns: [table.workspaceSubdomain, table.sessionClassId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Session Class Schedules (Model 6).
 */
export const sessionClassSchedules = pgTable(
  "session_class_schedules",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionClassId: text("session_class_id").notNull(),
    scheduleType: varchar("schedule_type", { length: 100 }).notNull(),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionClassId, table.id] }),
    index("session_class_schedules_workspace_class_idx").on(
      table.workspaceSubdomain,
      table.sessionClassId,
    ),
    foreignKey({
      name: "session_class_schedules_class_fk",
      columns: [table.workspaceSubdomain, table.sessionClassId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Session Class Budgets (Model 6: Income, Expense).
 */
export const sessionClassBudgets = pgTable(
  "session_class_budgets",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionClassId: text("session_class_id").notNull(),
    budgetType: varchar("budget_type", { length: 20 }).notNull(), // 'income' | 'expense'
    detail: text("detail").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionClassId, table.id] }),
    index("session_class_budgets_workspace_class_idx").on(
      table.workspaceSubdomain,
      table.sessionClassId,
    ),
    foreignKey({
      name: "session_class_budgets_class_fk",
      columns: [table.workspaceSubdomain, table.sessionClassId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Session Class Discounts (Model 6).
 */
export const sessionClassDiscounts = pgTable(
  "session_class_discounts",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionClassId: text("session_class_id").notNull(),
    discountType: varchar("discount_type", { length: 100 }).notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull().default("0"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    eligibilityCriteria: jsonb("eligibility_criteria")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionClassId, table.id] }),
    index("session_class_discounts_workspace_class_idx").on(
      table.workspaceSubdomain,
      table.sessionClassId,
    ),
    foreignKey({
      name: "session_class_discounts_class_fk",
      columns: [table.workspaceSubdomain, table.sessionClassId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Session Class Timetables (Model 6).
 */
export const sessionClassTimetables = pgTable(
  "session_class_timetables",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionClassId: text("session_class_id").notNull(),
    date: date("date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionClassId, table.id] }),
    index("session_class_timetables_workspace_class_idx").on(
      table.workspaceSubdomain,
      table.sessionClassId,
    ),
    foreignKey({
      name: "session_class_timetables_class_fk",
      columns: [table.workspaceSubdomain, table.sessionClassId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("cascade"),
    uniqueIndex("session_class_timetables_ws_id_uidx").on(table.workspaceSubdomain, table.id),
  ],
);

/**
 * Session Class Timetable Periods (Model 6).
 */
export const sessionClassTimetablePeriods = pgTable(
  "session_class_timetable_periods",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    timetableId: text("timetable_id").notNull(),
    startTime: varchar("start_time", { length: 20 }).notNull(),
    endTime: varchar("end_time", { length: 20 }).notNull(),
    subjectId: text("subject_id"),
    facultyId: text("faculty_id"),
    facultyName: varchar("faculty_name", { length: 255 }).default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.timetableId, table.id] }),
    foreignKey({
      name: "session_class_timetable_periods_subject_fk",
      columns: [table.workspaceSubdomain, table.subjectId],
      foreignColumns: [subjects.workspaceSubdomain, subjects.id],
    }).onDelete("restrict"),
    index("session_class_timetable_periods_workspace_subject_idx").on(
      table.workspaceSubdomain,
      table.subjectId,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.facultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("restrict"),
    index("session_class_timetable_periods_workspace_timetable_idx").on(
      table.workspaceSubdomain,
      table.timetableId,
    ),
    foreignKey({
      name: "session_class_timetable_periods_timetable_fk",
      columns: [table.workspaceSubdomain, table.timetableId],
      foreignColumns: [sessionClassTimetables.workspaceSubdomain, sessionClassTimetables.id],
    }).onDelete("cascade"),
    index("session_class_timetable_periods_workspace_faculty_idx").on(
      table.workspaceSubdomain,
      table.facultyId,
    ),
  ],
);

/**
 * Session Class Refreshments (Model 6).
 */
export const sessionClassRefreshments = pgTable(
  "session_class_refreshments",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionClassId: text("session_class_id").notNull(),
    date: date("date", { mode: "string" }),
    item: varchar("item", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    pricePerUnit: numeric("price_per_unit", { precision: 12, scale: 2 }).notNull().default("0"),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionClassId, table.id] }),
    index("session_class_refreshments_workspace_class_idx").on(
      table.workspaceSubdomain,
      table.sessionClassId,
    ),
    foreignKey({
      name: "session_class_refreshments_class_fk",
      columns: [table.workspaceSubdomain, table.sessionClassId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Scholarship Eligibility criteria profiles (Model 6).
 */
export const scholarshipEligibilities = pgTable(
  "scholarship_eligibilities",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    orphan: boolean("orphan").notNull().default(false),
    job: boolean("job").notNull().default(false),
    business: boolean("business").notNull().default(false),
    property: boolean("property").notNull().default(false),
    familyMembers: integer("family_members").notNull().default(1),
    onJobMembers: integer("on_job_members").notNull().default(0),
    schoolGoingSiblings: integer("school_going_siblings").notNull().default(0),
    residence: varchar("residence", { length: 100 }).notNull().default("rental"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("scholarship_eligibilities_workspace_idx").on(table.workspaceSubdomain),
  ],
);

/**
 * Session Class Scholarships (Model 6).
 */
export const sessionClassScholarships = pgTable(
  "session_class_scholarships",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionClassId: text("session_class_id").notNull(),
    scholarshipEligibilityId: text("scholarship_eligibility_id"),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull().default("0"),
    expiryDate: date("expiry_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionClassId, table.id] }),
    index("session_class_scholarships_workspace_class_idx").on(
      table.workspaceSubdomain,
      table.sessionClassId,
    ),
    foreignKey({
      name: "session_class_scholarships_class_fk",
      columns: [table.workspaceSubdomain, table.sessionClassId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Lookups & Setup Tables
 */
export const sessionLookups = pgTable(
  "session_lookups",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    uniqueIndex("session_lookups_workspace_kind_sort_idx").on(
      table.workspaceSubdomain,
      table.kind,
      table.sortOrder,
    ),
    index("session_lookups_workspace_kind_idx").on(table.workspaceSubdomain, table.kind),
  ],
);

export const sessionFieldConfigs = pgTable(
  "session_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export const sessionModulePreferences = pgTable(
  "session_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */
export type SessionRow = typeof sessions.$inferSelect;
export type InsertSessionRow = typeof sessions.$inferInsert;
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

/** Session row as read by the app: `type` is derived from the program (migration 0179). */
export type SessionReadRow = typeof sessions.$inferSelect & { type: string };
