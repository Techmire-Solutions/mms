import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { sessions, sessionClasses } from "./sessions.js";
import { sessionClassSections } from "./sessionSections.js";

/** Holidays, make-up days, exam periods and events (migration 0170; Attendance-owned). */
export const academicCalendarEvents = pgTable(
  "academic_calendar_events",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    title: varchar("title", { length: 150 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull(),
    startOn: date("start_on", { mode: "string" }).notNull(),
    endOn: date("end_on", { mode: "string" }).notNull(),
    scope: varchar("scope", { length: 20 }).notNull().default("workspace"),
    sessionId: text("session_id"),
    classId: text("class_id"),
    sectionId: text("section_id"),
    notes: text("notes"),
    createdBy: text("created_by"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    // Mirrors of the DB constraints created by migration 0170 (mms-schema-migrate §1).
    check(
      "academic_calendar_events_kind_check",
      sql`${table.kind} IN ('holiday', 'makeup_day', 'exam_period', 'event')`,
    ),
    check(
      "academic_calendar_events_scope_check",
      sql`${table.scope} IN ('workspace', 'session', 'class', 'section')`,
    ),
    check("academic_calendar_events_period_check", sql`${table.endOn} >= ${table.startOn}`),
    check("academic_calendar_events_title_not_blank_check", sql`btrim(${table.title}) <> ''`),
    check(
      "academic_calendar_events_scope_refs_check",
      sql`(${table.scope} = 'workspace' AND ${table.sessionId} IS NULL AND ${table.classId} IS NULL AND ${table.sectionId} IS NULL)
        OR (${table.scope} = 'session' AND ${table.sessionId} IS NOT NULL AND ${table.classId} IS NULL AND ${table.sectionId} IS NULL)
        OR (${table.scope} = 'class' AND ${table.sessionId} IS NOT NULL AND ${table.classId} IS NOT NULL AND ${table.sectionId} IS NULL)
        OR (${table.scope} = 'section' AND ${table.sessionId} IS NOT NULL AND ${table.classId} IS NOT NULL AND ${table.sectionId} IS NOT NULL)`,
    ),
    foreignKey({
      name: "academic_calendar_events_session_fk",
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "academic_calendar_events_class_fk",
      columns: [table.workspaceSubdomain, table.sessionId, table.classId],
      foreignColumns: [
        sessionClasses.workspaceSubdomain,
        sessionClasses.sessionId,
        sessionClasses.id,
      ],
    }).onDelete("cascade"),
    foreignKey({
      name: "academic_calendar_events_section_fk",
      columns: [table.workspaceSubdomain, table.sectionId],
      foreignColumns: [sessionClassSections.workspaceSubdomain, sessionClassSections.id],
    }).onDelete("cascade"),
    index("academic_calendar_events_range_active_idx")
      .on(table.workspaceSubdomain, table.startOn, table.endOn)
      .where(sql`${table.deletedAt} is null`),
    index("academic_calendar_events_session_idx").on(table.workspaceSubdomain, table.sessionId),
    index("academic_calendar_events_class_idx").on(
      table.workspaceSubdomain,
      table.sessionId,
      table.classId,
    ),
    index("academic_calendar_events_section_idx").on(table.workspaceSubdomain, table.sectionId),
    index("academic_calendar_events_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("academic_calendar_events_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("academic_calendar_events_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

/** Per-session weekly teaching days (0 = Sunday); absent rows = workspace working days. */
export const sessionWorkingDays = pgTable(
  "session_working_days",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    weekday: smallint("weekday").notNull(),
  },
  (table) => [
    primaryKey({
      name: "session_working_days_pk",
      columns: [table.workspaceSubdomain, table.sessionId, table.weekday],
    }),
    foreignKey({
      name: "session_working_days_session_fk",
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("cascade"),
  ],
);

export type AcademicCalendarEventRow = typeof academicCalendarEvents.$inferSelect;
export type InsertAcademicCalendarEventRow = typeof academicCalendarEvents.$inferInsert;
export type SessionWorkingDayRow = typeof sessionWorkingDays.$inferSelect;
