import {
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { faculty } from "./faculty.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { sessionClasses } from "./sessions.js";
import { subjects } from "./academicCatalogs.js";

/** Sections (A, B…) of a session class (migration 0167). Roster, room and capacity live here. */
export const sessionClassSections = pgTable(
  "session_class_sections",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    classId: text("class_id").notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    capacity: integer("capacity").notNull().default(30),
    room: varchar("room", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "session_class_sections_class_fk",
      columns: [table.workspaceSubdomain, table.sessionId, table.classId],
      foreignColumns: [
        sessionClasses.workspaceSubdomain,
        sessionClasses.sessionId,
        sessionClasses.id,
      ],
    }).onDelete("cascade"),
    index("session_class_sections_workspace_class_idx").on(table.workspaceSubdomain, table.classId),
    index("session_class_sections_workspace_session_idx").on(
      table.workspaceSubdomain,
      table.sessionId,
    ),
    uniqueIndex("session_class_sections_class_name_uidx").on(
      table.workspaceSubdomain,
      table.classId,
      sql`lower(btrim(${table.name}))`,
    ),
  ],
);

/** Effective-dated section staff (class / subject / assistant teachers); changes close + open rows. */
export const sectionStaffAssignments = pgTable(
  "section_staff_assignments",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    facultyId: text("faculty_id").notNull(),
    role: varchar("role", { length: 30 }).notNull(),
    subjectId: text("subject_id"),
    startOn: date("start_on", { mode: "string" }).notNull(),
    endOn: date("end_on", { mode: "string" }),
    changeReason: varchar("change_reason", { length: 500 }),
    createdBy: text("created_by"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "section_staff_assignments_section_fk",
      columns: [table.workspaceSubdomain, table.sectionId],
      foreignColumns: [sessionClassSections.workspaceSubdomain, sessionClassSections.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "section_staff_assignments_faculty_fk",
      columns: [table.workspaceSubdomain, table.facultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "section_staff_assignments_subject_fk",
      columns: [table.workspaceSubdomain, table.subjectId],
      foreignColumns: [subjects.workspaceSubdomain, subjects.id],
    }).onDelete("restrict"),
    index("section_staff_assignments_section_active_idx")
      .on(table.workspaceSubdomain, table.sectionId, table.startOn)
      .where(sql`${table.deletedAt} is null`),
    index("section_staff_assignments_faculty_active_idx")
      .on(table.workspaceSubdomain, table.facultyId, table.startOn)
      .where(sql`${table.deletedAt} is null`),
    index("section_staff_assignments_subject_idx").on(table.workspaceSubdomain, table.subjectId),
    index("section_staff_assignments_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
  ],
);

/** Student monitors / assistants of a section (enrollment-based, never faculty rows). */
export const sectionStudentRoles = pgTable(
  "section_student_roles",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    enrollmentId: text("enrollment_id").notNull(),
    role: varchar("role", { length: 30 }).notNull(),
    startOn: date("start_on", { mode: "string" }).notNull(),
    endOn: date("end_on", { mode: "string" }),
    createdBy: text("created_by"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "section_student_roles_section_fk",
      columns: [table.workspaceSubdomain, table.sectionId],
      foreignColumns: [sessionClassSections.workspaceSubdomain, sessionClassSections.id],
    }).onDelete("cascade"),
    index("section_student_roles_section_active_idx")
      .on(table.workspaceSubdomain, table.sectionId)
      .where(sql`${table.deletedAt} is null`),
    index("section_student_roles_enrollment_idx").on(table.workspaceSubdomain, table.enrollmentId),
    index("section_student_roles_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
  ],
);

/** Extra teachers on a timetable period (primary teacher stays on the period row). */
export const sessionClassTimetablePeriodStaff = pgTable(
  "session_class_timetable_period_staff",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    periodId: text("period_id").notNull(),
    facultyId: text("faculty_id").notNull(),
    role: varchar("role", { length: 30 }).notNull().default("assistant"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "session_class_timetable_period_staff_faculty_fk",
      columns: [table.workspaceSubdomain, table.facultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("restrict"),
    index("session_class_timetable_period_staff_period_idx").on(
      table.workspaceSubdomain,
      table.periodId,
    ),
    index("session_class_timetable_period_staff_faculty_idx").on(
      table.workspaceSubdomain,
      table.facultyId,
    ),
    uniqueIndex("session_class_timetable_period_staff_period_faculty_uidx").on(
      table.workspaceSubdomain,
      table.periodId,
      table.facultyId,
    ),
  ],
);

export type SessionClassSectionRow = typeof sessionClassSections.$inferSelect;
export type SectionStaffAssignmentRow = typeof sectionStaffAssignments.$inferSelect;
export type SectionStudentRoleRow = typeof sectionStudentRoles.$inferSelect;
