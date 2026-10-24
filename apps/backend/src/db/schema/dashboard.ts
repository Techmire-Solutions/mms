import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  boolean,
  jsonb,
  primaryKey,
  varchar,
} from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";

/** Dashboard layout/chart preferences — workspace singleton (was document-store `mms_dashboard_preferences`). */
export const dashboardPreferences = pgTable(
  "dashboard_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Dashboard pinned/custom widgets — normalized rows (was document-store `kpi_custom_widgets`). */
export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    widgetType: varchar("widget_type", { length: 64 }),
    category: varchar("category", { length: 64 }).notNull(),
    collection: varchar("collection", { length: 64 }).notNull(),
    role: varchar("role", { length: 32 }),
    isPinnedToDashboard: boolean("is_pinned_to_dashboard").notNull().default(false),
    title: varchar("title", { length: 255 }).notNull(),
    icon: varchar("icon", { length: 64 }),
    color: varchar("color", { length: 32 }).notNull(),
    operation: varchar("operation", { length: 32 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Remaining widget fields (i18n keys, switch/threshold/chart-render settings). */
    config: jsonb("config").$type<Record<string, unknown> | null>(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("dashboard_widgets_workspace_pinned_idx").on(
      table.workspaceSubdomain,
      table.isPinnedToDashboard,
    ),
    index("dashboard_widgets_workspace_sort_idx").on(
      table.workspaceSubdomain,
      table.sortOrder,
      table.id,
    ),
  ],
);

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type DashboardPreferencesRow = typeof dashboardPreferences.$inferSelect;
export type InsertDashboardPreferencesRow = typeof dashboardPreferences.$inferInsert;
export type DashboardWidgetRow = typeof dashboardWidgets.$inferSelect;
export type InsertDashboardWidgetRow = typeof dashboardWidgets.$inferInsert;
