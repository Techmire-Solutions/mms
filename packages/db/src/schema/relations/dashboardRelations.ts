import { relations } from "drizzle-orm";
import { workspaces } from "../platform.js";
import { dashboardPreferences, dashboardWidgets } from "../dashboard.js";

export const dashboardPreferencesRelations = relations(dashboardPreferences, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [dashboardPreferences.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
}));

export const dashboardWidgetsRelations = relations(dashboardWidgets, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [dashboardWidgets.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
}));
