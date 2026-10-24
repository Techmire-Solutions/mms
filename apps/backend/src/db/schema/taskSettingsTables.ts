import { pgTable, text, boolean, varchar, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

export const taskModulePreferences = pgTable(
  "task_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .primaryKey()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    delegationScope: varchar("delegation_scope", { length: 32 }).notNull().default("descendants"),
    allowSelfAssignment: boolean("allow_self_assignment").notNull().default(true),
    notifyOnAssignment: boolean("notify_on_assignment").notNull().default(true),
    notifyOnStatusChange: boolean("notify_on_status_change").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "task_module_preferences_scope_check",
      sql`${t.delegationScope} IN ('descendants', 'direct_reports')`,
    ),
  ],
);

export type TaskModulePreferencesRow = typeof taskModulePreferences.$inferSelect;
export type InsertTaskModulePreferencesRow = typeof taskModulePreferences.$inferInsert;
