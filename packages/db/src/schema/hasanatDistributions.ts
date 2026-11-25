import {
  date,
  pgTable,
  text,
  timestamp,
  index,
  integer,
  primaryKey,
  varchar,
  foreignKey,
  check,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { faculty } from "./faculty.js";
import { sessionClasses, sessions } from "./sessions.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { hasanatBatches, hasanatDenoms } from "./hasanatDenomsBatches.js";

/** Issued Hasanat cards: soft-deletable, value stamped at issue, lifecycle-managed. */

export const hasanatDistributions = pgTable(
  "hasanat_distributions",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    batchId: text("batch_id").notNull(),
    denominationId: text("denomination_id").notNull(),
    denominationName: varchar("denomination_name", { length: 120 }).notNull().default(""),
    recipientType: varchar("recipient_type", { length: 20 }).notNull().default("student"),
    recipientStudentId: varchar("recipient_student_id", { length: 64 }),
    recipientFacultyId: varchar("recipient_faculty_id", { length: 64 }),
    recipientName: varchar("recipient_name", { length: 255 }).notNull().default(""),
    recipientClass: varchar("recipient_class", { length: 120 }).notNull().default(""),
    /** `session_classes.id` at issue time; `recipientClass` stays as the display snapshot. */
    classId: text("class_id"),
    /**
     * `sessions.id` at issue time — stamped on write from `classId`. Required for per-session
     * point aggregation; rows that cannot be attributed stay NULL and are reported as unattributed.
     */
    sessionId: text("session_id"),
    quantity: integer("quantity").notNull().default(1),
    /**
     * Immutable card value stamped at issue (`denomination.points × quantity`). Reports, redemption
     * bounds and vouchers read this — never the live denomination row.
     */
    pointsSnapshot: integer("points_snapshot").notNull().default(0),
    /** Optimistic-concurrency token for card edits. */
    version: integer("version").notNull().default(0),
    /** Idempotency key for issuance; a replay returns the original card. */
    clientRequestId: varchar("client_request_id", { length: 64 }),
    /** Derived expiry: an active card past this date reads as expired (no stored transition). */
    expiresOn: date("expires_on", { mode: "string" }),
    reason: text("reason").notNull().default(""),
    issuedDate: date("issued_date", { mode: "string" }).notNull(),
    issuedByUserId: text("issued_by_user_id"),
    issuedBy: varchar("issued_by", { length: 120 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.batchId],
      foreignColumns: [hasanatBatches.workspaceSubdomain, hasanatBatches.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.denominationId],
      foreignColumns: [hasanatDenoms.workspaceSubdomain, hasanatDenoms.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.recipientStudentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.recipientFacultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("set null"),
    index("hasanat_dist_workspace_faculty_idx").on(
      table.workspaceSubdomain,
      table.recipientFacultyId,
    ),
    index("hasanat_dist_workspace_batch_idx").on(table.workspaceSubdomain, table.batchId),
    foreignKey({
      name: "hasanat_distributions_class_fk",
      columns: [table.workspaceSubdomain, table.classId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("restrict"),
    index("hasanat_distributions_class_idx").on(table.workspaceSubdomain, table.classId),
    foreignKey({
      name: "hasanat_distributions_session_fk",
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("restrict"),
    index("hasanat_dist_ws_session_student_idx").on(
      table.workspaceSubdomain,
      table.sessionId,
      table.recipientStudentId,
    ),
    /** Balance / history aggregation: tenant + student + session + status in one descent. */
    index("hasanat_dist_ws_student_session_status_idx").on(
      table.workspaceSubdomain,
      table.recipientStudentId,
      table.sessionId,
      table.status,
    ),
    index("hasanat_dist_ws_student_issued_active_idx")
      .on(table.workspaceSubdomain, table.recipientStudentId, table.issuedDate.desc())
      .where(sql`${table.deletedAt} is null`),
    index("hasanat_dist_workspace_denom_idx").on(table.workspaceSubdomain, table.denominationId),
    index("hasanat_dist_workspace_issued_date_idx").on(table.workspaceSubdomain, table.issuedDate),
    index("hasanat_dist_workspace_issued_by_idx").on(
      table.workspaceSubdomain,
      table.issuedByUserId,
    ),
    /** Instructor daily-quota count: one index descent per (tenant, instructor, day). */
    index("hasanat_dist_ws_issuer_date_idx").on(
      table.workspaceSubdomain,
      table.issuedByUserId,
      table.issuedDate,
    ),
    uniqueIndex("hasanat_dist_ws_client_request_uidx")
      .on(table.workspaceSubdomain, table.clientRequestId)
      .where(sql`${table.clientRequestId} is not null`),
    /** Default Work list sort (`ORDER BY updated_at DESC`). */
    index("hasanat_dist_ws_updated_active_idx")
      .on(table.workspaceSubdomain, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
    /** Status-filtered Work list sort. */
    index("hasanat_dist_ws_status_updated_active_idx")
      .on(table.workspaceSubdomain, table.status, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
    index("hasanat_dist_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("hasanat_dist_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check("hasanat_dist_quantity_chk", sql`${table.quantity} > 0`),
    check("hasanat_dist_points_snapshot_chk", sql`${table.pointsSnapshot} >= 0`),
    check("hasanat_dist_status_chk", sql`${table.status} in ('active', 'redeemed', 'returned')`),
    check("hasanat_dist_recipient_type_chk", sql`${table.recipientType} in ('student', 'faculty')`),
    check(
      "hasanat_dist_recipient_exclusive_chk",
      sql`${table.recipientStudentId} is null or ${table.recipientFacultyId} is null`,
    ),
  ],
);
