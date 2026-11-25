import { pgTable, text, timestamp, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";

/**
 * Per-workspace Accounting configuration blobs (fields config + module
 * preferences), split out of `accounting.ts` to keep that file inside the
 * 300-line ceiling.
 */

export const accountingFieldConfigs = pgTable(
  "accounting_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export const accountingModulePreferences = pgTable(
  "accounting_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export type AccountingFieldConfigsRow = typeof accountingFieldConfigs.$inferSelect;
export type InsertAccountingFieldConfigsRow = typeof accountingFieldConfigs.$inferInsert;
export type AccountingModulePreferencesRow = typeof accountingModulePreferences.$inferSelect;
export type InsertAccountingModulePreferencesRow = typeof accountingModulePreferences.$inferInsert;
