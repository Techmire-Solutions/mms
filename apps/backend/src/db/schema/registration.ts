import { boolean, date, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './platform.js';
import { softDeleteColumns } from './softDeleteSchema.js';
import { sessions, sessionClasses } from './sessions.js';
import { sessionClassSections } from './sessionSections.js';
import { students } from './students.js';
import { enrollments } from './enrollments.js';

/** Public registration links of a session (migration 0174). */
export const sessionRegistrationLinks = pgTable('session_registration_links', {
  id: text('id').notNull(),
  workspaceSubdomain: text('workspace_subdomain').notNull().references(() => workspaces.subdomain, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  title: varchar('title', { length: 150 }),
  isActive: boolean('is_active').notNull().default(true),
  opensAt: timestamp('opens_at', { withTimezone: true, mode: 'date' }),
  closesAt: timestamp('closes_at', { withTimezone: true, mode: 'date' }),
  maxSubmissions: integer('max_submissions'),
  requiresReview: boolean('requires_review').notNull().default(true),
  createdBy: text('created_by'),
  ...softDeleteColumns,
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
  foreignKey({ name: 'session_registration_links_session_fk', columns: [table.workspaceSubdomain, table.sessionId], foreignColumns: [sessions.workspaceSubdomain, sessions.id] }).onDelete('cascade'),
  uniqueIndex('session_registration_links_slug_uidx').on(table.workspaceSubdomain, table.slug),
  index('session_registration_links_session_idx').on(table.workspaceSubdomain, table.sessionId),
  index('session_registration_links_active_idx').on(table.workspaceSubdomain).where(sql`${table.deletedAt} is null and ${table.isActive}`),
  index('session_registration_links_workspace_deleted_idx').on(table.workspaceSubdomain, table.deletedAt),
]);

/** Classes offered on a link (no rows = every class of the session). */
export const registrationLinkClasses = pgTable('registration_link_classes', {
  workspaceSubdomain: text('workspace_subdomain').notNull().references(() => workspaces.subdomain, { onDelete: 'cascade' }),
  linkId: text('link_id').notNull(),
  classId: text('class_id').notNull(),
}, (table) => [
  primaryKey({ name: 'registration_link_classes_pk', columns: [table.workspaceSubdomain, table.linkId, table.classId] }),
  foreignKey({ name: 'registration_link_classes_link_fk', columns: [table.workspaceSubdomain, table.linkId], foreignColumns: [sessionRegistrationLinks.workspaceSubdomain, sessionRegistrationLinks.id] }).onDelete('cascade'),
  foreignKey({ name: 'registration_link_classes_class_fk', columns: [table.workspaceSubdomain, table.classId], foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id] }).onDelete('cascade'),
  index('registration_link_classes_class_idx').on(table.workspaceSubdomain, table.classId),
]);

/** Public applications awaiting review (Enrollments → Admissions). */
export const registrationApplications = pgTable('registration_applications', {
  id: text('id').notNull(),
  workspaceSubdomain: text('workspace_subdomain').notNull().references(() => workspaces.subdomain, { onDelete: 'cascade' }),
  reference: varchar('reference', { length: 20 }).notNull(),
  linkId: text('link_id').notNull(),
  sessionId: text('session_id').notNull(),
  classId: text('class_id').notNull(),
  preferredSectionId: text('preferred_section_id'),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  guardianName: varchar('guardian_name', { length: 150 }).notNull(),
  dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),
  gender: varchar('gender', { length: 10 }).notNull(),
  phone: varchar('phone', { length: 30 }).notNull(),
  email: varchar('email', { length: 200 }),
  address: varchar('address', { length: 500 }),
  previousMadrasa: varchar('previous_madrasa', { length: 200 }),
  status: varchar('status', { length: 20 }).notNull().default('submitted'),
  studentId: varchar('student_id', { length: 64 }),
  enrollmentId: text('enrollment_id'),
  reviewedBy: text('reviewed_by'),
  reviewReason: varchar('review_reason', { length: 500 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }),
  submittedIpHash: varchar('submitted_ip_hash', { length: 64 }),
  ...softDeleteColumns,
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
  foreignKey({ name: 'registration_applications_link_fk', columns: [table.workspaceSubdomain, table.linkId], foreignColumns: [sessionRegistrationLinks.workspaceSubdomain, sessionRegistrationLinks.id] }).onDelete('cascade'),
  foreignKey({ name: 'registration_applications_session_fk', columns: [table.workspaceSubdomain, table.sessionId], foreignColumns: [sessions.workspaceSubdomain, sessions.id] }).onDelete('cascade'),
  foreignKey({ name: 'registration_applications_class_fk', columns: [table.workspaceSubdomain, table.classId], foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id] }).onDelete('restrict'),
  foreignKey({ name: 'registration_applications_section_fk', columns: [table.workspaceSubdomain, table.preferredSectionId], foreignColumns: [sessionClassSections.workspaceSubdomain, sessionClassSections.id] }),
  foreignKey({ name: 'registration_applications_student_fk', columns: [table.workspaceSubdomain, table.studentId], foreignColumns: [students.workspaceSubdomain, students.id] }),
  foreignKey({ name: 'registration_applications_enrollment_fk', columns: [table.workspaceSubdomain, table.enrollmentId], foreignColumns: [enrollments.workspaceSubdomain, enrollments.id] }),
  uniqueIndex('registration_applications_reference_uidx').on(table.workspaceSubdomain, table.reference),
  index('registration_applications_session_status_idx').on(table.workspaceSubdomain, table.sessionId, table.status).where(sql`${table.deletedAt} is null`),
  index('registration_applications_link_idx').on(table.workspaceSubdomain, table.linkId),
  index('registration_applications_class_idx').on(table.workspaceSubdomain, table.classId),
  index('registration_applications_student_idx').on(table.workspaceSubdomain, table.studentId),
  index('registration_applications_enrollment_idx').on(table.workspaceSubdomain, table.enrollmentId),
  index('registration_applications_workspace_deleted_idx').on(table.workspaceSubdomain, table.deletedAt),
]);

export type RegistrationLinkRow = typeof sessionRegistrationLinks.$inferSelect;
export type RegistrationApplicationRow = typeof registrationApplications.$inferSelect;
