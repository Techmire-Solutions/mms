import {
  pgTable,
  text,
  timestamp,
  index,
  primaryKey,
  foreignKey,
  boolean,
  date,
  varchar,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { faculty } from "./faculty.js";
import { facultyDepartments } from "./facultyDepartmentTables.js";
import { facultyDesignations } from "./facultyDesignationTables.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

/**
 * Faculty multi-role temporal assignments (department + designation occupancy).
 */
export const facultyAssignments = pgTable(
  "faculty_assignments",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    facultyId: text("faculty_id").notNull(),
    departmentId: text("department_id").notNull(),
    designationId: text("designation_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    notes: text("notes"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("faculty_assignments_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("faculty_assignments_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_assignments_faculty_active_idx")
      .on(table.workspaceSubdomain, table.facultyId)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_assignments_dept_active_idx")
      .on(table.workspaceSubdomain, table.departmentId)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_assignments_designation_active_idx")
      .on(table.workspaceSubdomain, table.designationId)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_assignments_faculty_primary_active_idx")
      .on(table.workspaceSubdomain, table.facultyId, table.isPrimary)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_assignments_primary_active_covering_idx")
      .on(table.workspaceSubdomain, table.facultyId, table.startDate)
      .where(
        sql`${table.deletedAt} is null and ${table.isPrimary} = true and ${table.status} = 'active'`,
      ),
    index("faculty_assignments_faculty_open_active_idx")
      .on(table.workspaceSubdomain, table.facultyId)
      .where(sql`${table.deletedAt} is null and ${table.endDate} is null`),
    index("faculty_assignments_deleted_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check(
      "faculty_assignments_date_range_check",
      sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
    ),
    check("faculty_assignments_status_check", sql`${table.status} in ('active', 'inactive')`),
    foreignKey({
      columns: [table.workspaceSubdomain, table.facultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.departmentId],
      foreignColumns: [facultyDepartments.workspaceSubdomain, facultyDepartments.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.designationId],
      foreignColumns: [facultyDesignations.workspaceSubdomain, facultyDesignations.id],
    }).onDelete("restrict"),
  ],
);

export type FacultyAssignmentRow = typeof facultyAssignments.$inferSelect;
export type InsertFacultyAssignmentRow = typeof facultyAssignments.$inferInsert;
