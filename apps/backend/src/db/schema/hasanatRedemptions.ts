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
import { hasanatDistributions } from "./hasanatDistributions.js";

/** Append-only redemption ledger (corrections are reversal rows). */

export const hasanatRedemptions = pgTable(
  "hasanat_redemptions",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    distributionId: text("distribution_id").notNull(),
    /** `students.id` of the card recipient — the ledger's only student link. */
    studentId: varchar("student_id", { length: 64 }),
    studentName: varchar("student_name", { length: 255 }).notNull().default(""),
    reward: text("reward").notNull().default(""),
    pointsUsed: integer("points_used").notNull().default(0),
    /** `redeem` burns value; `reversal` corrects one redemption without mutating it. */
    kind: varchar("kind", { length: 16 }).notNull().default("redeem"),
    /** The redemption this row reverses (exactly one reversal per redemption). */
    reversalOfId: text("reversal_of_id"),
    /** Idempotency key for the atomic redeem action. */
    clientRequestId: varchar("client_request_id", { length: 64 }),
    date: date("date", { mode: "string" }).notNull(),
    approvedByUserId: text("approved_by_user_id"),
    approvedBy: varchar("approved_by", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.distributionId],
      foreignColumns: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "hasanat_redemptions_reversal_fk",
      columns: [table.workspaceSubdomain, table.reversalOfId],
      foreignColumns: [table.workspaceSubdomain, table.id],
    }).onDelete("restrict"),
    uniqueIndex("hasanat_redemp_ws_reversal_uidx")
      .on(table.workspaceSubdomain, table.reversalOfId)
      .where(sql`${table.reversalOfId} is not null`),
    uniqueIndex("hasanat_redemp_ws_client_request_uidx")
      .on(table.workspaceSubdomain, table.clientRequestId)
      .where(sql`${table.clientRequestId} is not null`),
    /** Ledger history for one card: `(tenant, card_id, created_at)`. */
    index("hasanat_redemp_ws_dist_created_idx").on(
      table.workspaceSubdomain,
      table.distributionId,
      table.createdAt.desc(),
    ),
    index("hasanat_redemp_workspace_date_idx").on(table.workspaceSubdomain, table.date),
    /** Ledger history ordering: newest first, one tenant descent. */
    index("hasanat_redemp_ws_created_idx").on(table.workspaceSubdomain, table.createdAt.desc()),
    index("hasanat_redemp_workspace_approved_by_idx").on(
      table.workspaceSubdomain,
      table.approvedByUserId,
    ),
    check("hasanat_redemp_points_used_chk", sql`${table.pointsUsed} > 0`),
    check("hasanat_redemp_kind_chk", sql`${table.kind} in ('redeem', 'reversal')`),
  ],
);
