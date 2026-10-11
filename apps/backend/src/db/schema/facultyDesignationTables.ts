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
  boolean,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { facultyDepartments } from "./facultyDepartmentTables.js";

/**
 * Faculty designations (master catalog per tenant).
 *
 * Faculty Management model: every designation belongs to a department
 * (`department_id`), may report to a parent designation in the same catalog
 * (`parent_designation_id`), and carries `status` (active | inactive).
 * `code`, `hierarchy_rank` and `is_active` are legacy expand-phase columns:
 * `hierarchy_rank` is derived from the parent chain depth, `is_active` mirrors
 * `status`, and `code` is a derived slug.
 */
export const facultyDesignations = pgTable(
  "faculty_designations",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    departmentId: text("department_id"),
    parentDesignationId: text("parent_designation_id"),
    name: varchar("name", { length: 150 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    /** @deprecated derived slug kept for legacy consumers. */
    code: varchar("code", { length: 50 }),
    /** Derived: 1-based depth in the parent chain (root = 1). */
    hierarchyRank: integer("hierarchy_rank").notNull(),
    /** @deprecated mirrors `status = 'active'`. */
    isActive: boolean("is_active").notNull().default(true),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("faculty_designations_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("faculty_designations_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("faculty_designations_ws_code_active_uidx")
      .on(table.workspaceSubdomain, table.code)
      .where(sql`${table.deletedAt} is null`),
    // Designation Name unique within its department (case-insensitive) among active rows
    uniqueIndex("faculty_designations_ws_dept_name_active_uidx")
      .on(table.workspaceSubdomain, table.departmentId, sql`lower(btrim(${table.name}))`)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_designations_department_active_idx")
      .on(table.workspaceSubdomain, table.departmentId)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_designations_parent_active_idx")
      .on(table.workspaceSubdomain, table.parentDesignationId)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_designations_active_rank_idx")
      .on(table.workspaceSubdomain, table.hierarchyRank)
      .where(sql`${table.deletedAt} is null`),
    index("faculty_designations_deleted_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check("faculty_designations_hierarchy_rank_positive_check", sql`${table.hierarchyRank} > 0`),
    check("faculty_designations_status_check", sql`${table.status} in ('active', 'inactive')`),
    check(
      "faculty_designations_no_self_parent_check",
      sql`${table.parentDesignationId} is null or ${table.parentDesignationId} <> ${table.id}`,
    ),
    foreignKey({
      name: "faculty_designations_department_fk",
      columns: [table.workspaceSubdomain, table.departmentId],
      foreignColumns: [facultyDepartments.workspaceSubdomain, facultyDepartments.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "faculty_designations_parent_fk",
      columns: [table.workspaceSubdomain, table.parentDesignationId],
      foreignColumns: [table.workspaceSubdomain, table.id],
    }).onDelete("restrict"),
  ],
);

/** Workspace roles that may be assigned while a designation is current. */
export const facultyDesignationRoles = pgTable(
  "faculty_designation_roles",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    designationId: text("designation_id").notNull(),
    roleKey: varchar("role_key", { length: 100 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.designationId, table.roleKey] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.designationId],
      foreignColumns: [facultyDesignations.workspaceSubdomain, facultyDesignations.id],
    }).onDelete("cascade"),
    index("faculty_designation_roles_workspace_role_idx").on(
      table.workspaceSubdomain,
      table.roleKey,
    ),
  ],
);

export type FacultyDesignationRow = typeof facultyDesignations.$inferSelect;
export type InsertFacultyDesignationRow = typeof facultyDesignations.$inferInsert;
export type FacultyDesignationRoleRow = typeof facultyDesignationRoles.$inferSelect;
export type InsertFacultyDesignationRoleRow = typeof facultyDesignationRoles.$inferInsert;
