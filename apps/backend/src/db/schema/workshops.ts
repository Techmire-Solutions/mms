/**
 * Reserved module — schema only, no application surface (see `inventory.ts`).
 * No repository/route/use-case reads these tables; do not add CRUD without
 * product sign-off — removal needs a forward-only `DROP TABLE` migration.
 * Migration 0178 aligned the workshop tables with the short-course plan (capacity, deadline,
 * fee, program / subject, soft-delete, per-day `workshop_attendance`) ahead of that surface.
 */
import {
  pgTable,
  text,
  timestamp,
  numeric,
  varchar,
  integer,
  primaryKey,
  foreignKey,
  index,
  uniqueIndex,
  date,
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
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }),
    endDate: timestamp("end_date", { withTimezone: true, mode: "date" }),
    capacity: integer("capacity"),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true, mode: "date" }),
    fee: numeric("fee", { precision: 12, scale: 2 }),
    programId: text("program_id"),
    subjectId: text("subject_id"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("workshop_events_workspace_start_date_idx").on(table.workspaceSubdomain, table.startDate),
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
      .where(sql`${table.deletedAt} IS NULL`),
    index("workshop_events_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
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
    ...softDeleteColumns,
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
      .where(sql`${table.deletedAt} IS NULL`),
    index("workshop_participants_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("workshop_participants_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} IS NULL`),
    index("workshop_participants_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ],
);

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
      columns: [table.workspaceSubdomain, table.participantId],
      foreignColumns: [workshopParticipants.workspaceSubdomain, workshopParticipants.id],
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
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.workshopId],
      foreignColumns: [workshopEvents.workspaceSubdomain, workshopEvents.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.participantId],
      foreignColumns: [workshopParticipants.workspaceSubdomain, workshopParticipants.id],
    }).onDelete("cascade"),
    index("workshop_scores_workspace_workshop_idx").on(table.workspaceSubdomain, table.workshopId),
    index("workshop_scores_workspace_participant_idx").on(
      table.workspaceSubdomain,
      table.participantId,
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
export type WorkshopScore = typeof workshopScores.$inferSelect;
export type NewWorkshopScore = typeof workshopScores.$inferInsert;
export type WorkshopAttendance = typeof workshopAttendance.$inferSelect;
export type NewWorkshopAttendance = typeof workshopAttendance.$inferInsert;
export type CompetitionEvent = typeof competitionEvents.$inferSelect;
export type NewCompetitionEvent = typeof competitionEvents.$inferInsert;
export type CompetitionParticipant = typeof competitionParticipants.$inferSelect;
export type NewCompetitionParticipant = typeof competitionParticipants.$inferInsert;
