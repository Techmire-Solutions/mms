import {
  pgTable,
  pgView,
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
  date,
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
    /** `*_on` columns since migration 0181 (the legacy varchars are trigger-filled until 0182). */
    registeredDate: date("registered_on", { mode: "string" }),
    enrollmentDate: date("enrollment_on", { mode: "string" }),
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
    index("students_workspace_registered_on_idx").on(
      table.workspaceSubdomain,
      table.registeredDate,
    ),
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
  ],
);

/**
 * Legacy memberships with no enrollment history (migration 0181). Read through the
 * `student_session_memberships` view; a pair is consumed once the student is enrolled in the session.
 */
export const studentEnrolledSessionsLegacy = pgTable(
  "student_enrolled_sessions_legacy",
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
    uniqueIndex("student_enrolled_sessions_legacy_pair_uidx").on(
      table.workspaceSubdomain,
      table.studentId,
      table.sessionId,
    ),
    index("student_enrolled_sessions_legacy_session_idx").on(
      table.workspaceSubdomain,
      table.sessionId,
    ),
    foreignKey({
      name: "student_enrolled_sessions_legacy_student_fk",
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "student_enrolled_sessions_legacy_session_fk",
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Student ↔ session membership (`student_session_memberships` view, migration 0181): sessions with
 * a live, seat-holding enrollment, plus legacy pairs from `student_enrolled_sessions_legacy`.
 * Read-only. The old `student_enrolled_sessions` table is trigger-mirrored until 0182 drops it.
 */
export const studentEnrolledSessions = pgView("student_session_memberships", {
  id: text("id").notNull(),
  workspaceSubdomain: text("workspace_subdomain").notNull(),
  studentId: text("student_id").notNull(),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
}).existing();

export * from "./studentSetupTables.js";

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type StudentRow = typeof students.$inferSelect;
export type StudentSelectRow = StudentRow;
export type InsertStudentRow = typeof students.$inferInsert;
export type StudentEnrolledSessionRow = typeof studentEnrolledSessions.$inferSelect;
export type InsertStudentEnrolledSessionLegacyRow =
  typeof studentEnrolledSessionsLegacy.$inferInsert;
