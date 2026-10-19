import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  jsonb,
  primaryKey,
  foreignKey,
  varchar,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";
import { faculty } from "./faculty.js";
import { subjects } from "./academicCatalogs.js";
import { sessionClasses } from "./sessionCoreTables.js";

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
    /** Display snapshot of `subjects.name`; `subjectId` is authoritative. */
    subject: varchar("subject", { length: 150 }).notNull(),
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
