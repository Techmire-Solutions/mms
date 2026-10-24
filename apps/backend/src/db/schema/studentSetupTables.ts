import { pgTable, text, timestamp, index, integer, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";
import type { StudentModulePreferences } from "@mms/shared";

/**
 * Students Setup option lists (statuses, genderFilters, discountTypes).
 */
export const studentLookups = pgTable(
  "student_lookups",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("student_lookups_workspace_kind_sort_idx").on(
      table.workspaceSubdomain,
      table.kind,
      table.sortOrder,
    ),
  ],
);

/** Students Setup field registry. */
export const studentFieldConfigs = pgTable(
  "student_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Students Setup preferences — GR / auto-id. */
export const studentModulePreferences = pgTable(
  "student_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<StudentModulePreferences>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Deterministic, concurrency-safe GR number generation sequence tracking. */
export const studentSequenceConfig = pgTable(
  "student_sequence_config",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    currentSequence: integer("current_sequence").notNull().default(0),
    lastYear: integer("last_year").notNull().default(2026),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export type StudentLookupsRow = typeof studentLookups.$inferSelect;
export type InsertStudentLookupsRow = typeof studentLookups.$inferInsert;
export type StudentFieldConfigsRow = typeof studentFieldConfigs.$inferSelect;
export type InsertStudentFieldConfigsRow = typeof studentFieldConfigs.$inferInsert;
export type StudentModulePreferencesRow = typeof studentModulePreferences.$inferSelect;
export type InsertStudentModulePreferencesRow = typeof studentModulePreferences.$inferInsert;
export type StudentSequenceConfigRow = typeof studentSequenceConfig.$inferSelect;
export type InsertStudentSequenceConfigRow = typeof studentSequenceConfig.$inferInsert;
