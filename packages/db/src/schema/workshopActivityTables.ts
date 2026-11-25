/**
 * Workshop activity child rows — split out of `workshops.ts` for the 300-line band.
 *
 * `workshop_attendance` (one check-in per participant per day, migration 0178) and
 * `workshop_scores` (one score per participant per criterion, 0185) are append-only children of a
 * registration: they carry no soft-delete sextuple and are removed only by the FK cascade or the
 * workspace purge. Both FKs are tenant-composite and carry `workshop_id`, so a mark can only name a
 * participant of the same workshop (migration 0244).
 */
import {
  pgTable,
  text,
  timestamp,
  numeric,
  varchar,
  primaryKey,
  foreignKey,
  index,
  uniqueIndex,
  date,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { workshopEvents, workshopParticipants } from "./workshops.js";

/** Per-day check-in of a workshop participant (migration 0178). */
export const workshopAttendance = pgTable(
  "workshop_attendance",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    workshopId: text("workshop_id").notNull(),
    participantId: text("participant_id").notNull(),
    dayOn: date("day_on", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    markedBy: text("marked_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "workshop_attendance_workshop_fk",
      columns: [table.workspaceSubdomain, table.workshopId],
      foreignColumns: [workshopEvents.workspaceSubdomain, workshopEvents.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "workshop_attendance_participant_fk",
      columns: [table.workspaceSubdomain, table.participantId, table.workshopId],
      foreignColumns: [
        workshopParticipants.workspaceSubdomain,
        workshopParticipants.id,
        workshopParticipants.workshopId,
      ],
    }).onDelete("cascade"),
    uniqueIndex("workshop_attendance_participant_day_uidx").on(
      table.workspaceSubdomain,
      table.participantId,
      table.dayOn,
    ),
    index("workshop_attendance_workshop_day_idx").on(
      table.workspaceSubdomain,
      table.workshopId,
      table.dayOn,
    ),
    // Attendance aggregates filter present/late; including status keeps the scan index-only.
    index("workshop_attendance_ws_workshop_day_status_idx").on(
      table.workspaceSubdomain,
      table.workshopId,
      table.dayOn,
      table.status,
    ),
    check(
      "workshop_attendance_status_check",
      sql`${table.status} IN ('present', 'absent', 'late', 'excused')`,
    ),
  ],
);

export const workshopScores = pgTable(
  "workshop_scores",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    workshopId: text("workshop_id").notNull(),
    participantId: text("participant_id").notNull(),
    criterionName: text("criterion_name").notNull(),
    score: numeric("score", { precision: 15, scale: 2 }).notNull(),
    maxScore: numeric("max_score", { precision: 15, scale: 2 }).notNull(),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.workshopId],
      foreignColumns: [workshopEvents.workspaceSubdomain, workshopEvents.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "workshop_scores_participant_fk",
      columns: [table.workspaceSubdomain, table.participantId, table.workshopId],
      foreignColumns: [
        workshopParticipants.workspaceSubdomain,
        workshopParticipants.id,
        workshopParticipants.workshopId,
      ],
    }).onDelete("cascade"),
    index("workshop_scores_workspace_workshop_idx").on(table.workspaceSubdomain, table.workshopId),
    uniqueIndex("workshop_scores_participant_criterion_uidx").on(
      table.workspaceSubdomain,
      table.participantId,
      table.criterionName,
    ),
    index("workshop_scores_workspace_participant_idx").on(
      table.workspaceSubdomain,
      table.participantId,
    ),
    check(
      "workshop_scores_range_check",
      sql`${table.maxScore} > 0 AND ${table.score} >= 0 AND ${table.score} <= ${table.maxScore}`,
    ),
  ],
);

export type WorkshopScore = typeof workshopScores.$inferSelect;
export type NewWorkshopScore = typeof workshopScores.$inferInsert;
export type WorkshopAttendance = typeof workshopAttendance.$inferSelect;
export type NewWorkshopAttendance = typeof workshopAttendance.$inferInsert;
