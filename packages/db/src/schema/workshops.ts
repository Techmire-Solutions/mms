/**
 * Workshops module (product sign-off 2026-10-24). Migration 0178 aligned these tables with the
 * short-course plan (capacity, deadline, fee, program / subject, soft-delete, per-day
 * `workshop_attendance`, split out to `workshopActivityTables.ts` for the 300-line band); 0185 made
 * the event dates calendar days and added timestamps, the per-criterion score key and CHECK
 * constraints. `competition_*` below remain reserved.
 */
import {
  pgTable,
  text,
  timestamp,
  numeric,
  varchar,
  integer,
  boolean,
  primaryKey,
  foreignKey,
  index,
  uniqueIndex,
  date,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { contacts } from "./contacts.js";
import { students } from "./students.js";
import { programs, subjects } from "./academicCatalogs.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

export const workshopEvents = pgTable(
  "workshop_events",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    capacity: integer("capacity"),
    /** Queue registrations once full instead of refusing them (migration 0246). */
    waitlistEnabled: boolean("waitlist_enabled").notNull().default(false),
    registrationDeadline: date("registration_deadline", { mode: "string" }),
    fee: numeric("fee", { precision: 12, scale: 2 }),
    programId: text("program_id"),
    subjectId: text("subject_id"),
    minAttendancePct: numeric("min_attendance_pct", { precision: 5, scale: 2 }),
    minScorePct: numeric("min_score_pct", { precision: 5, scale: 2 }),
    /**
     * Persisted lifecycle intent (migration 0245): `draft | open | completed | cancelled`.
     * `archived` is `deleted_at` and the date-driven phases are derived, never stored.
     */
    status: varchar("status", { length: 20 }).notNull().default("open"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("workshop_events_workspace_start_date_idx").on(table.workspaceSubdomain, table.startDate),
    // Calendar / Work-list / Reports hot path: active events ordered by start day. Covers the
    // metrics and report scans too, so no heap fetch is needed for the date comparisons.
    index("workshop_events_workspace_active_dates_idx")
      .on(table.workspaceSubdomain, table.startDate, table.endDate)
      .where(sql`${table.deletedAt} is null`),
    // Mirrors the Zod rule (`workshopEventCreateSchema`): the deadline cannot fall after the last
    // workshop day. Added NOT VALID + validated by migration 0244.
    check(
      "workshop_events_deadline_check",
      sql`${table.registrationDeadline} IS NULL
          OR coalesce(${table.endDate}, ${table.startDate}) IS NULL
          OR ${table.registrationDeadline} <= coalesce(${table.endDate}, ${table.startDate})`,
    ),
    // The remaining CHECKs were added by raw SQL (0178 / 0185 / 0186) and are mirrored here so the
    // Drizzle schema tells the truth about the table (mms-schema-migrate §1).
    check(
      "workshop_events_capacity_check",
      sql`${table.capacity} IS NULL OR ${table.capacity} > 0`,
    ),
    check(
      "workshop_events_dates_check",
      sql`${table.startDate} IS NULL OR ${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
    check("workshop_events_fee_check", sql`${table.fee} IS NULL OR ${table.fee} >= 0`),
    check(
      "workshop_events_status_check",
      sql`${table.status} IN ('draft', 'open', 'completed', 'cancelled')`,
    ),
    check(
      "workshop_events_criteria_check",
      sql`(${table.minAttendancePct} IS NULL OR ${table.minAttendancePct} BETWEEN 0 AND 100)
          AND (${table.minScorePct} IS NULL OR ${table.minScorePct} BETWEEN 0 AND 100)`,
    ),
    foreignKey({
      name: "workshop_events_program_fk",
      columns: [table.workspaceSubdomain, table.programId],
      foreignColumns: [programs.workspaceSubdomain, programs.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "workshop_events_subject_fk",
      columns: [table.workspaceSubdomain, table.subjectId],
      foreignColumns: [subjects.workspaceSubdomain, subjects.id],
    }).onDelete("restrict"),
    index("workshop_events_program_idx")
      .on(table.workspaceSubdomain, table.programId)
      .where(sql`${table.programId} IS NOT NULL`),
    index("workshop_events_subject_idx")
      .on(table.workspaceSubdomain, table.subjectId)
      .where(sql`${table.subjectId} IS NOT NULL`),
    index("workshop_events_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("workshop_events_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("workshop_events_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    // Analytics: metrics status buckets and report ordering without a heap fetch for status.
    index("workshop_events_ws_status_dates_active_idx")
      .on(table.workspaceSubdomain, table.status, table.startDate, table.endDate)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const workshopParticipants = pgTable(
  "workshop_participants",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    workshopId: text("workshop_id").notNull(),
    contactId: text("contact_id").notNull(),
    status: varchar("status", { length: 20 }).default("registered").notNull(), // 'registered' | 'attended' | 'completed'
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    certificateIssuedAt: timestamp("certificate_issued_at", { withTimezone: true, mode: "date" }),
    /** Set while the row is queued for a full workshop; null means it holds a seat (0246). */
    waitlistedAt: timestamp("waitlisted_at", { withTimezone: true, mode: "date" }),
    ...softDeleteColumns,
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
      columns: [table.workspaceSubdomain, table.contactId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
    }).onDelete("cascade"),
    index("workshop_participants_workspace_workshop_idx").on(
      table.workspaceSubdomain,
      table.workshopId,
    ),
    index("workshop_participants_workspace_contact_idx").on(
      table.workspaceSubdomain,
      table.contactId,
    ),
    uniqueIndex("workshop_participants_contact_uidx")
      .on(table.workspaceSubdomain, table.workshopId, table.contactId)
      .where(sql`${table.deletedAt} is null`),
    /**
     * FK target for the child tables. `(workspace_subdomain, id)` is already the primary key, so
     * this index is logically redundant — PostgreSQL still requires a unique constraint that
     * exactly matches a composite foreign key, and it is what keeps a check-in from naming a
     * participant of a *different* workshop.
     */
    uniqueIndex("workshop_participants_workshop_scoped_uidx").on(
      table.workspaceSubdomain,
      table.id,
      table.workshopId,
    ),
    index("workshop_participants_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("workshop_participants_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("workshop_participants_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    // Seat/roster and completion counts: only seated, live rows.
    index("workshop_participants_ws_active_workshop_idx")
      .on(table.workspaceSubdomain, table.workshopId)
      .where(sql`${table.deletedAt} is null and ${table.waitlistedAt} is null`),
    index("workshop_participants_ws_active_status_idx")
      .on(table.workspaceSubdomain, table.workshopId, table.status)
      .where(sql`${table.deletedAt} is null and ${table.waitlistedAt} is null`),
    /** Promotion order: oldest waitlisted seat first. */
    index("workshop_participants_workshop_waitlist_idx")
      .on(table.workspaceSubdomain, table.workshopId, table.waitlistedAt)
      .where(sql`${table.deletedAt} is null and ${table.waitlistedAt} is not null`),
    check(
      "workshop_participants_status_check",
      sql`${table.status} IN ('registered', 'attended', 'completed')`,
    ),
    check(
      "workshop_participants_certificate_check",
      sql`${table.certificateIssuedAt} IS NULL OR ${table.completedAt} IS NOT NULL`,
    ),
    check(
      "workshop_participants_waitlist_check",
      sql`${table.waitlistedAt} IS NULL OR ${table.status} = 'registered'`,
    ),
  ],
);

/** Per-workspace Setup defaults applied to new workshops (migration 0186). */
export const workshopModulePreferences = pgTable(
  "workshop_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .primaryKey()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    defaultMinAttendancePct: numeric("default_min_attendance_pct", { precision: 5, scale: 2 }),
    defaultMinScorePct: numeric("default_min_score_pct", { precision: 5, scale: 2 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "workshop_module_preferences_range_check",
      sql`(${table.defaultMinAttendancePct} IS NULL
            OR ${table.defaultMinAttendancePct} BETWEEN 0 AND 100)
          AND (${table.defaultMinScorePct} IS NULL
            OR ${table.defaultMinScorePct} BETWEEN 0 AND 100)`,
    ),
  ],
);

export const competitionEvents = pgTable(
  "competition_events",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventDate: timestamp("event_date", { withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain, table.id] })],
);

export const competitionParticipants = pgTable(
  "competition_participants",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    competitionId: text("competition_id").notNull(),
    studentId: text("student_id").notNull(),
    rank: integer("rank"),
    score: numeric("score", { precision: 15, scale: 2 }),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.competitionId],
      foreignColumns: [competitionEvents.workspaceSubdomain, competitionEvents.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    index("competition_participants_workspace_comp_idx").on(
      table.workspaceSubdomain,
      table.competitionId,
    ),
    index("competition_participants_workspace_student_idx").on(
      table.workspaceSubdomain,
      table.studentId,
    ),
  ],
);

export type WorkshopEvent = typeof workshopEvents.$inferSelect;
export type NewWorkshopEvent = typeof workshopEvents.$inferInsert;
export type WorkshopParticipant = typeof workshopParticipants.$inferSelect;
export type NewWorkshopParticipant = typeof workshopParticipants.$inferInsert;
export type CompetitionEvent = typeof competitionEvents.$inferSelect;
export type NewCompetitionEvent = typeof competitionEvents.$inferInsert;
export type CompetitionParticipant = typeof competitionParticipants.$inferSelect;
export type NewCompetitionParticipant = typeof competitionParticipants.$inferInsert;
