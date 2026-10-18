import { date, foreignKey, index, pgTable, primaryKey, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './platform.js';
import { softDeleteColumns } from './softDeleteSchema.js';
import { sessions, sessionClasses } from './sessions.js';
import { sessionClassSections } from './sessionSections.js';

/** Holidays, make-up days, exam periods and events (migration 0170; Attendance-owned). */
export const academicCalendarEvents = pgTable('academic_calendar_events', {
  id: text('id').notNull(),
  workspaceSubdomain: text('workspace_subdomain').notNull().references(() => workspaces.subdomain, { onDelete: 'cascade' }),
  title: varchar('title', { length: 150 }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull(),
  startOn: date('start_on', { mode: 'string' }).notNull(),
  endOn: date('end_on', { mode: 'string' }).notNull(),
  scope: varchar('scope', { length: 20 }).notNull().default('workspace'),
  sessionId: text('session_id'),
  classId: text('class_id'),
  sectionId: text('section_id'),
  notes: text('notes'),
  createdBy: text('created_by'),
  ...softDeleteColumns,
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
  foreignKey({ name: 'academic_calendar_events_session_fk', columns: [table.workspaceSubdomain, table.sessionId], foreignColumns: [sessions.workspaceSubdomain, sessions.id] }).onDelete('cascade'),
  foreignKey({
    name: 'academic_calendar_events_class_fk',
    columns: [table.workspaceSubdomain, table.sessionId, table.classId],
    foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.sessionId, sessionClasses.id],
  }).onDelete('cascade'),
  foreignKey({ name: 'academic_calendar_events_section_fk', columns: [table.workspaceSubdomain, table.sectionId], foreignColumns: [sessionClassSections.workspaceSubdomain, sessionClassSections.id] }).onDelete('cascade'),
  index('academic_calendar_events_range_active_idx').on(table.workspaceSubdomain, table.startOn, table.endOn).where(sql`${table.deletedAt} is null`),
  index('academic_calendar_events_session_idx').on(table.workspaceSubdomain, table.sessionId),
  index('academic_calendar_events_class_idx').on(table.workspaceSubdomain, table.sessionId, table.classId),
  index('academic_calendar_events_section_idx').on(table.workspaceSubdomain, table.sectionId),
  index('academic_calendar_events_workspace_active_idx').on(table.workspaceSubdomain).where(sql`${table.deletedAt} is null`),
  index('academic_calendar_events_workspace_deleted_idx').on(table.workspaceSubdomain, table.deletedAt),
  index('academic_calendar_events_deleted_records_idx').on(table.workspaceSubdomain, table.deletedAt).where(sql`${table.deletedAt} is not null`),
]);

/** Per-session weekly teaching days (0 = Sunday); absent rows = workspace working days. */
export const sessionWorkingDays = pgTable('session_working_days', {
  workspaceSubdomain: text('workspace_subdomain').notNull().references(() => workspaces.subdomain, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  weekday: smallint('weekday').notNull(),
}, (table) => [
  primaryKey({ name: 'session_working_days_pk', columns: [table.workspaceSubdomain, table.sessionId, table.weekday] }),
  foreignKey({ name: 'session_working_days_session_fk', columns: [table.workspaceSubdomain, table.sessionId], foreignColumns: [sessions.workspaceSubdomain, sessions.id] }).onDelete('cascade'),
]);

export type AcademicCalendarEventRow = typeof academicCalendarEvents.$inferSelect;
export type InsertAcademicCalendarEventRow = typeof academicCalendarEvents.$inferInsert;
export type SessionWorkingDayRow = typeof sessionWorkingDays.$inferSelect;
