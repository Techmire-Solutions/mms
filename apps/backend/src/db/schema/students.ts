import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  primaryKey,
  foreignKey,
  varchar,
  numeric,
  check,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { contacts } from "./contacts.js";
import { sessions } from "./sessions.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

/**
 * Students entity rows — normalized 3NF relational columns.
 */
export const students = pgTable(
  "students",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    contactId: text("contact_id"),
    fatherContactId: text("father_contact_id"),
    motherContactId: text("mother_contact_id"),
    guardianContactId: text("guardian_contact_id"),
    fatherName: varchar("father_name", { length: 255 }),
    motherName: varchar("mother_name", { length: 255 }),
    guardianName: varchar("guardian_name", { length: 255 }),
    grNumber: varchar("gr_number", { length: 100 }),
    studentId: varchar("student_id", { length: 100 }),
    // Status values enforced at DB level by students_status_check constraint (migration 0162).
    status: varchar("status", { length: 50 }).notNull().default("active"),
    registeredDate: varchar("registered_date", { length: 35 }),
    enrollmentDate: varchar("enrollment_date", { length: 35 }),
    discountType: varchar("discount_type", { length: 100 }),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }),
    registrationType: varchar("registration_type", { length: 100 }),
    notes: text("notes"),
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("students_workspace_id_active_idx")
      .on(table.workspaceSubdomain, table.id)
      .where(sql`${table.deletedAt} is null`),
    index("students_workspace_status_id_active_idx")
      .on(table.workspaceSubdomain, table.status, table.id)
      .where(sql`${table.deletedAt} is null`),
    index("students_workspace_created_at_active_idx")
      .on(table.workspaceSubdomain, table.createdAt)
      .where(sql`${table.deletedAt} is null`),
    index("students_workspace_updated_at_active_idx")
      .on(table.workspaceSubdomain, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index("students_workspace_status_updated_at_active_idx")
      .on(table.workspaceSubdomain, table.status, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index("students_workspace_status_coalesce_updated_at_active_idx")
      .on(table.workspaceSubdomain, sql`COALESCE(${table.status}, 'active')`, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index("students_workspace_registered_date_active_idx")
      .on(table.workspaceSubdomain, table.registeredDate)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("students_workspace_gr_number_active_uidx")
      .on(table.workspaceSubdomain, sql`lower(btrim(${table.grNumber}))`)
      .where(
        sql`${table.deletedAt} is null and ${table.grNumber} is not null and btrim(${table.grNumber}) <> ''`,
      ),
    uniqueIndex("students_workspace_student_id_active_uidx")
      .on(table.workspaceSubdomain, sql`lower(btrim(${table.studentId}))`)
      .where(
        sql`${table.deletedAt} is null and ${table.studentId} is not null and btrim(${table.studentId}) <> ''`,
      ),
    index("students_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    // Phase 1: 1:1 contact-to-student mapping enforced by partial unique index (migration 0163).
    uniqueIndex("students_workspace_contact_active_uidx")
      .on(table.workspaceSubdomain, table.contactId)
      .where(sql`${table.deletedAt} is null and ${table.contactId} is not null`),
    index("students_workspace_contact_deleted_idx")
      .on(table.workspaceSubdomain, table.contactId)
      .where(sql`${table.deletedAt} is not null`),
    index("students_workspace_father_contact_idx").on(
      table.workspaceSubdomain,
      table.fatherContactId,
    ),
    index("students_workspace_mother_contact_idx").on(
      table.workspaceSubdomain,
      table.motherContactId,
    ),
    index("students_workspace_guardian_contact_idx").on(
      table.workspaceSubdomain,
      table.guardianContactId,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.fatherContactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.motherContactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.guardianContactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("set null"),
    // P1-2: Enforce valid status values at DB level (mirrors STUDENT_STATUS_VALUES in @mms/shared).
    check(
      "students_status_check",
      sql`lower(trim(COALESCE(${table.status}, 'active'))) IN ('active','inactive','suspended','graduated','transferred')`,
    ),
    // P1-4: Enforce discount_pct in [0, 100] when set.
    check(
      "students_discount_pct_range_check",
      sql`${table.discountPct} IS NULL OR (${table.discountPct} >= 0 AND ${table.discountPct} <= 100)`,
    ),
    // P1-5: Enforce valid ISO dates when present.
    check(
      "students_registered_date_iso_check",
      sql`${table.registeredDate} IS NULL OR ${table.registeredDate} = '' OR ${table.registeredDate} ~ '^\d{4}-\d{2}-\d{2}'`,
    ),
    check(
      "students_enrollment_date_iso_check",
      sql`${table.enrollmentDate} IS NULL OR ${table.enrollmentDate} = '' OR ${table.enrollmentDate} ~ '^\d{4}-\d{2}-\d{2}'`,
    ),
  ],
);

export const studentEnrolledSessions = pgTable(
  "student_enrolled_sessions",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    studentId: text("student_id").notNull(),
    sessionId: varchar("session_id", { length: 100 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.studentId, table.id] }),
    // P1-3: Unique constraint prevents duplicate enrolment rows from concurrent bulk-enroll races.
    uniqueIndex("student_enrolled_sessions_workspace_student_session_uidx").on(
      table.workspaceSubdomain,
      table.studentId,
      table.sessionId,
    ),
    index("student_enrolled_sessions_workspace_session_idx").on(
      table.workspaceSubdomain,
      table.sessionId,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("cascade"),
  ],
);

export * from "./studentSetupTables.js";

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type StudentRow = typeof students.$inferSelect;
export type InsertStudentRow = typeof students.$inferInsert;
export type StudentEnrolledSessionRow = typeof studentEnrolledSessions.$inferSelect;
export type InsertStudentEnrolledSessionRow = typeof studentEnrolledSessions.$inferInsert;
