import {
  pgTable,
  text,
  timestamp,
  integer,
  varchar,
  primaryKey,
  foreignKey,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";

/**
 * Materialized tier/badge awards.
 *
 * The displayed tier is always derived from current lifetime earned points; this table is the
 * evidence trail. Rows are never deleted — a retroactive reduction revokes the award
 * (`revoked_at` + reason), and recovering the tier inserts a new row (the partial unique index only
 * constrains live awards).
 */
export const hasanatStudentAwards = pgTable(
  "hasanat_student_awards",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 64 }).notNull(),
    tierKey: varchar("tier_key", { length: 32 }).notNull(),
    tierName: varchar("tier_name", { length: 60 }).notNull().default(""),
    /** `tier` today; reserved for non-threshold badges. */
    kind: varchar("kind", { length: 16 }).notNull().default("tier"),
    /** Lifetime earned points at the moment the award was granted. */
    earnedSnapshot: integer("earned_snapshot").notNull().default(0),
    awardedAt: timestamp("awarded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    revokedReason: varchar("revoked_reason", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("restrict"),
    index("hasanat_award_ws_student_idx").on(table.workspaceSubdomain, table.studentId),
    index("hasanat_award_ws_tier_awarded_idx").on(
      table.workspaceSubdomain,
      table.tierKey,
      table.awardedAt,
    ),
    /** One live award per (student, tier); a re-earned tier gets a new row. */
    uniqueIndex("hasanat_award_ws_student_tier_uidx")
      .on(table.workspaceSubdomain, table.studentId, table.tierKey)
      .where(sql`${table.revokedAt} is null`),
    check("hasanat_award_kind_chk", sql`${table.kind} in ('tier', 'badge')`),
    check("hasanat_award_earned_chk", sql`${table.earnedSnapshot} >= 0`),
  ],
);
