import { pgTable, text, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";

/** Users Setup field registry (was document-store `users_settings` fields slice). */
export const userFieldConfigs = pgTable(
  "user_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Users Setup preferences — registration + workspaceRoles (was document-store prefs slice). */
export const userModulePreferences = pgTable(
  "user_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Per-user Users Work column layout (was document-store `users_user_column_preferences`). */
/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type UserFieldConfigsRow = typeof userFieldConfigs.$inferSelect;
export type InsertUserFieldConfigsRow = typeof userFieldConfigs.$inferInsert;
export type UserModulePreferencesRow = typeof userModulePreferences.$inferSelect;
export type InsertUserModulePreferencesRow = typeof userModulePreferences.$inferInsert;
