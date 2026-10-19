import {
  boolean,
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
import { softDeleteColumns } from "./softDeleteSchema.js";

/**
 * Academic master data (migration 0166): session categories, programs and subjects.
 * All three share one shape so a single repository/router serves them.
 */
function academicCatalogTable<TName extends string>(name: TName) {
  return pgTable(
    name,
    {
      id: text("id").notNull(),
      workspaceSubdomain: text("workspace_subdomain")
        .notNull()
        .references(() => workspaces.subdomain, { onDelete: "cascade" }),
      code: varchar("code", { length: 32 }),
      name: varchar("name", { length: 150 }).notNull(),
      shortName: varchar("short_name", { length: 32 }),
      status: varchar("status", { length: 20 }).notNull().default("active"),
      sortOrder: integer("sort_order").notNull().default(0),
      isSystem: boolean("is_system").notNull().default(false),
      ...softDeleteColumns,
      createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow(),
      createdBy: text("created_by"),
      updatedBy: text("updated_by"),
    },
    (table) => [
      primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
      index(`${name}_workspace_deleted_idx`).on(table.workspaceSubdomain, table.deletedAt),
      index(`${name}_workspace_active_idx`)
        .on(table.workspaceSubdomain, table.status, table.sortOrder)
        .where(sql`${table.deletedAt} is null`),
      index(`${name}_workspace_deleted_records_idx`)
        .on(table.workspaceSubdomain, table.deletedAt)
        .where(sql`${table.deletedAt} is not null`),
      uniqueIndex(`${name}_workspace_name_active_uidx`)
        .on(table.workspaceSubdomain, sql`lower(btrim(${table.name}))`)
        .where(sql`${table.deletedAt} is null`),
    ],
  );
}

export const sessionCategories = academicCatalogTable("session_categories");
export const programs = academicCatalogTable("programs");
export const subjects = academicCatalogTable("subjects");

export type AcademicCatalogTable = typeof sessionCategories | typeof programs | typeof subjects;
export type AcademicCatalogRow = typeof sessionCategories.$inferSelect;
export type InsertAcademicCatalogRow = typeof sessionCategories.$inferInsert;
