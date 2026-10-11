import {
  pgTable,
  text,
  timestamp,
  index,
  jsonb,
  primaryKey,
  varchar,
  bigint,
  numeric,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { sessions, sessionClasses } from "./sessions.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

export const enrollments = pgTable(
  "enrollments",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 64 }).notNull(),
    studentName: varchar("student_name", { length: 255 }).notNull().default(""),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    sessionName: varchar("session_name", { length: 255 }).notNull().default(""),
    classId: varchar("class_id", { length: 64 }).notNull(),
    className: varchar("class_name", { length: 255 }).notNull().default(""),
    enrolledDate: varchar("enrolled_date", { length: 10 }).notNull(),
    baseFee: numeric("base_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    discountType: varchar("discount_type", { length: 32 }).notNull().default("none"),
    discountLabel: varchar("discount_label", { length: 120 }).notNull().default(""),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    discountAmt: numeric("discount_amt", { precision: 12, scale: 2 }).notNull().default("0"),
    finalFee: numeric("final_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    invoiceId: varchar("invoice_id", { length: 64 }),
    paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("none"),
    notes: text("notes").notNull().default(""),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("enrollments_workspace_session_idx").on(table.workspaceSubdomain, table.sessionId),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "enrollments_session_class_fk",
      columns: [table.workspaceSubdomain, table.sessionId, table.classId],
      foreignColumns: [
        sessionClasses.workspaceSubdomain,
        sessionClasses.sessionId,
        sessionClasses.id,
      ],
    }),
    index("enrollments_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
    index("enrollments_workspace_class_idx").on(table.workspaceSubdomain, table.classId),
    index("enrollments_workspace_date_idx").on(table.workspaceSubdomain, table.enrolledDate),
    index("enrollments_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    index("enrollments_workspace_invoice_idx").on(table.workspaceSubdomain, table.invoiceId),
    index("enrollments_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("enrollments_workspace_updated_at_active_idx")
      .on(table.workspaceSubdomain, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index("enrollments_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("enrollments_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

export const enrollmentTimelineEvents = pgTable(
  "enrollment_timeline_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id").notNull(),
    event: varchar("event", { length: 120 }).notNull(),
    by: varchar("by", { length: 120 }).notNull(),
    ts: varchar("ts", { length: 40 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("enrollment_timeline_enrollment_idx").on(table.workspaceSubdomain, table.enrollmentId),
  ],
);

/** Enrollments Setup field registry (was document-store `enrollments_settings` fields slice). */
export const enrollmentFieldConfigs = pgTable(
  "enrollment_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Enrollments Setup preferences (was document-store `enrollments_settings` prefs slice). */
export const enrollmentModulePreferences = pgTable(
  "enrollment_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Per-user Enrollments Work column layout (was document-store `enrollment_user_column_preferences`). */
/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type EnrollmentRow = typeof enrollments.$inferSelect;
export type InsertEnrollmentRow = typeof enrollments.$inferInsert;
export type EnrollmentTimelineEventRow = typeof enrollmentTimelineEvents.$inferSelect;
export type InsertEnrollmentTimelineEventRow = typeof enrollmentTimelineEvents.$inferInsert;
export type EnrollmentFieldConfigsRow = typeof enrollmentFieldConfigs.$inferSelect;
export type InsertEnrollmentFieldConfigsRow = typeof enrollmentFieldConfigs.$inferInsert;
export type EnrollmentModulePreferencesRow = typeof enrollmentModulePreferences.$inferSelect;
export type InsertEnrollmentModulePreferencesRow = typeof enrollmentModulePreferences.$inferInsert;
