import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  foreignKey,
  varchar,
  date,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { facultyEmployments } from "./facultyEmploymentTables.js";
import { facultyDesignations } from "./facultyDesignationTables.js";

/**
 * Employ Designation — tenure linking an Employment Record to a catalog Designation.
 *
 * Faculty Management model: Employ Designation ID (`id`), `employment_id`,
 * `designation_id` (UI shows Department + Designation), start/end dates,
 * Active|Inactive status. Faculty row mirrors are dual-written until contract.
 */
export const facultyEmployDesignations = pgTable(
  "faculty_employ_designations",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    employmentId: text("employment_id").notNull(),
    designationId: text("designation_id").notNull(),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("faculty_employ_designations_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("faculty_employ_designations_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_employ_designations_employment_active_idx")
      .on(table.workspaceSubdomain, table.employmentId)
      .where(sql`${table.deletedAt} is null`),
    // Concurrent active open tenures allowed for different designation_id; same designation blocked.
    uniqueIndex("faculty_employ_designations_emp_desig_active_uidx")
      .on(table.workspaceSubdomain, table.employmentId, table.designationId)
      .where(
        sql`${table.deletedAt} is null and lower(btrim(${table.status})) = 'active' and ${table.endDate} is null`,
      ),
    index("faculty_employ_designations_designation_active_idx")
      .on(table.workspaceSubdomain, table.designationId)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_employ_designations_deleted_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check(
      "faculty_employ_designations_status_check",
      sql`lower(btrim(${table.status})) in ('active', 'inactive')`,
    ),
    check(
      "faculty_employ_designations_period_check",
      sql`${table.endDate} is null or ${table.startDate} is null or ${table.endDate} >= ${table.startDate}`,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.employmentId],
      foreignColumns: [facultyEmployments.workspaceSubdomain, facultyEmployments.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.designationId],
      foreignColumns: [facultyDesignations.workspaceSubdomain, facultyDesignations.id],
    }).onDelete("restrict"),
  ],
);

export type FacultyEmployDesignationRow = typeof facultyEmployDesignations.$inferSelect;
export type InsertFacultyEmployDesignationRow = typeof facultyEmployDesignations.$inferInsert;
