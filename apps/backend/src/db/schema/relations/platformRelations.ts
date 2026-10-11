import { relations } from "drizzle-orm";
import {
  workspaces,
  platformUsers,
  platformUserPermissions,
  platformActivityLogs,
} from "../platform.js";
import { backgroundJobs, savedReports, userActivityLogs } from "../system.js";
import { auditTrailEvents, auditVerificationRuns } from "../auditTrail.js";
import { tenantUsers } from "../contacts.js";

export const platformUsersRelations = relations(platformUsers, ({ many }) => ({
  permissions: many(platformUserPermissions),
  activityLogs: many(platformActivityLogs),
}));

export const platformUserPermissionsRelations = relations(platformUserPermissions, ({ one }) => ({
  user: one(platformUsers, {
    fields: [platformUserPermissions.platformUserId],
    references: [platformUsers.id],
  }),
}));

export const platformActivityLogsRelations = relations(platformActivityLogs, ({ one }) => ({
  user: one(platformUsers, {
    fields: [platformActivityLogs.userId],
    references: [platformUsers.id],
  }),
}));

export const backgroundJobsRelations = relations(backgroundJobs, ({ one }) => ({
  user: one(tenantUsers, {
    fields: [backgroundJobs.tenantId, backgroundJobs.userId],
    references: [tenantUsers.workspaceSubdomain, tenantUsers.id],
  }),
}));

export const savedReportsRelations = relations(savedReports, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [savedReports.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
}));

export const userActivityLogsRelations = relations(userActivityLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [userActivityLogs.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
}));

export const auditTrailEventsRelations = relations(auditTrailEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [auditTrailEvents.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
}));

export const auditVerificationRunsRelations = relations(auditVerificationRuns, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [auditVerificationRuns.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
}));
