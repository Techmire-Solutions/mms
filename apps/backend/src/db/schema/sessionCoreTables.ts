import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  primaryKey,
  foreignKey,
  varchar,
  numeric,
  date,
  boolean,
  smallint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { faculty } from "./faculty.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { sessionCategories, programs } from "./academicCatalogs.js";

/**
 * Academic Sessions entity rows (Model 6).
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    /** Session Category (Academic Year, Term, Short Course, …) — `session_categories`. */
    categoryId: text("category_id"),
    /** Optional default Program for the session's classes — `programs`. */
    programId: text("program_id"),
    /** Lifecycle state (draft | open | in_progress | completed | cancelled | archived) — see sessionLifecycle. */
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    baseFee: numeric("base_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 20 }).notNull().default("PKR"),
    description: text("description"),
    /** Short-course completion criteria (migration 0178). */
    minAttendancePct: smallint("min_attendance_pct"),
    requiresExamPass: boolean("requires_exam_pass").notNull().default(false),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "sessions_category_fk",
      columns: [table.workspaceSubdomain, table.categoryId],
      foreignColumns: [sessionCategories.workspaceSubdomain, sessionCategories.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "sessions_program_fk",
      columns: [table.workspaceSubdomain, table.programId],
      foreignColumns: [programs.workspaceSubdomain, programs.id],
    }).onDelete("restrict"),
    index("sessions_workspace_category_idx").on(table.workspaceSubdomain, table.categoryId),
    index("sessions_workspace_program_idx").on(table.workspaceSubdomain, table.programId),
    index("sessions_workspace_name_idx").on(table.workspaceSubdomain, table.name),
    index("sessions_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    index("sessions_workspace_start_date_idx").on(table.workspaceSubdomain, table.startDate),
    index("sessions_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("sessions_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("sessions_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

/**
 * Session Management / Faculty assigned to session (Model 6).
 */
export const sessionFaculty = pgTable(
  "session_faculty",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    facultyId: text("faculty_id").notNull(),
    facultyName: varchar("faculty_name", { length: 255 }).notNull().default(""),
    role: varchar("role", { length: 100 }).notNull().default("coordinator"),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.facultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("restrict"),
    index("session_faculty_workspace_session_idx").on(table.workspaceSubdomain, table.sessionId),
    index("session_faculty_workspace_faculty_idx").on(table.workspaceSubdomain, table.facultyId),
  ],
);

/**
 * Session Classes (Model 6).
 */
export const sessionClasses = pgTable(
  "session_classes",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    gender: varchar("gender", { length: 20 }).notNull().default("mixed"),
    ageCalculationDate: date("age_calc_date", { mode: "string" }),
    ageMin: integer("age_min").notNull().default(4),
    ageMax: integer("age_max").notNull().default(25),
    capacity: integer("capacity").notNull().default(30), // Max Student Count
    enrolled: integer("enrolled").notNull().default(0),
    enrollmentDeadline: varchar("enrollment_deadline", { length: 35 }).notNull().default(""),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    facultyId: text("faculty_id"),
    facultyName: varchar("faculty_name", { length: 255 }).default(""),
    room: varchar("room", { length: 100 }).default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    programId: text("program_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sessionId, table.id] }),
    foreignKey({
      name: "session_classes_program_fk",
      columns: [table.workspaceSubdomain, table.programId],
      foreignColumns: [programs.workspaceSubdomain, programs.id],
    }).onDelete("restrict"),
    index("session_classes_workspace_program_idx").on(table.workspaceSubdomain, table.programId),
    foreignKey({
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.facultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("restrict"),
    uniqueIndex("session_classes_ws_id_uidx").on(table.workspaceSubdomain, table.id),
    index("session_classes_workspace_session_idx").on(table.workspaceSubdomain, table.sessionId),
    index("session_classes_workspace_faculty_idx").on(table.workspaceSubdomain, table.facultyId),
    uniqueIndex("session_classes_workspace_session_name_uidx").on(
      table.workspaceSubdomain,
      table.sessionId,
      sql`lower(btrim(regexp_replace(${table.name}, '[[:space:]]+', ' ', 'g')))`,
    ),
  ],
);
