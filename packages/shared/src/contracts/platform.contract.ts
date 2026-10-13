import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  platformSetupRegisterBodySchema,
  platformPasswordForgotBodySchema,
  platformPasswordResetBodySchema,
  platformPasswordResendBodySchema,
  platformProfilePatchBodySchema,
  platformChangePasswordBodySchema,
  workspaceEnabledPatchBodySchema,
  platformWorkspaceModulesPatchBodySchema,
  workspaceEmailVerificationPatchBodySchema,
  workspaceDeleteBodySchema,
  workspaceResetAdminPasswordBodySchema,
  workspaceCreateAdminUserBodySchema,
  platformCreateAdminBodySchema,
  platformUpdateAdminPermissionsBodySchema,
  platformAdminDisabledBodySchema,
  platformDeleteAdminBodySchema,
  platformActivityLogsQuerySchema,
  platformUserDtoSchema as platformUserSchema,
  platformUserProfileDtoSchema as platformUserProfileSchema,
  platformSetupStatusDtoSchema as platformSetupStatusSchema,
  platformSettingsDtoSchema as platformSettingsSchema,
  platformWorkspaceRowDtoSchema as platformWorkspaceRowSchema,
  platformWorkspacesListQuerySchema,
  platformWorkspacesListResponseSchema,
  platformWorkspaceMetricsDtoSchema,
  platformActivityLogDtoSchema as platformActivityLogSchema,
  platformErrorDtoSchema as platformErrorSchema,
} from "../schemas/platform.dto.js";
import {
  loginBodySchema,
  challengeCodeBodySchema,
  challengeIdBodySchema,
  platformLoginResponseSchema,
} from "../schemas/auth.dto.js";
import {
  platformSettingsUpdateSchema,
  migrateAndRestartSchema,
} from "../auth/platformSettingsTypes.js";

const c = initContract();

const migrateAndRestartAcceptedSchema = z.object({
  success: z.literal(true),
  accepted: z.literal(true),
  message: z.string(),
  delayMs: z.number(),
});

// Workspaces
export const platformWorkspacesRoutes = {
  listWorkspaces: {
    method: "GET",
    path: "/api/platform/workspaces",
    query: platformWorkspacesListQuerySchema,
    responses: {
      200: platformWorkspacesListResponseSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "List workspaces (paginated)",
  },
  getWorkspaceMetrics: {
    method: "GET",
    path: "/api/platform/workspaces/metrics",
    responses: {
      200: platformWorkspaceMetricsDtoSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Workspace fleet KPI counts",
  },
  patchWorkspace: {
    method: "PATCH",
    path: "/api/platform/workspaces/:subdomain",
    pathParams: z.object({ subdomain: z.string() }),
    body: workspaceEnabledPatchBodySchema,
    responses: {
      200: z.object({ workspace: platformWorkspaceRowSchema }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Enable or disable a workspace",
  },
  deleteWorkspace: {
    method: "DELETE",
    path: "/api/platform/workspaces/:subdomain",
    pathParams: z.object({ subdomain: z.string() }),
    body: workspaceDeleteBodySchema,
    responses: {
      200: z.object({ deleted: z.literal(true), subdomain: z.string() }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Delete a workspace",
  },
  getWorkspaceModules: {
    method: "GET",
    path: "/api/platform/workspaces/:subdomain/modules",
    pathParams: z.object({ subdomain: z.string() }),
    responses: {
      200: z.object({ modules: z.array(z.string()) }),
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Get enabled modules for workspace",
  },
  updateWorkspaceModules: {
    method: "PATCH",
    path: "/api/platform/workspaces/:subdomain/modules",
    pathParams: z.object({ subdomain: z.string() }),
    body: platformWorkspaceModulesPatchBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), modules: z.array(z.string()) }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Update enabled modules for workspace",
  },
  patchWorkspaceEmailVerification: {
    method: "PATCH",
    path: "/api/platform/workspaces/:subdomain/email-verification",
    pathParams: z.object({ subdomain: z.string() }),
    body: workspaceEmailVerificationPatchBodySchema,
    responses: {
      200: z.object({
        success: z.literal(true),
        subdomain: z.string(),
        requireEmailVerification: z.boolean(),
      }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Toggle email verification requirement for a workspace",
  },
  verifyTenantUserEmail: {
    method: "POST",
    path: "/api/platform/workspaces/:subdomain/users/:userId/verify-email",
    pathParams: z.object({ subdomain: z.string(), userId: z.string() }),
    body: z.unknown().optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Manually verify tenant user email from platform apex",
  },
  resetWorkspaceAdminPassword: {
    method: "POST",
    path: "/api/platform/workspaces/:subdomain/reset-admin-password",
    pathParams: z.object({ subdomain: z.string() }),
    body: workspaceResetAdminPasswordBodySchema,
    responses: {
      200: z.object({
        success: z.literal(true),
        subdomain: z.string(),
        adminEmail: z.string(),
        newPassword: z.string(),
      }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Reset workspace admin user password from platform console",
  },
  createWorkspaceAdminUser: {
    method: "POST",
    path: "/api/platform/workspaces/:subdomain/admin-users",
    pathParams: z.object({ subdomain: z.string() }),
    body: workspaceCreateAdminUserBodySchema,
    responses: {
      200: z.object({
        success: z.literal(true),
        subdomain: z.string(),
        adminEmail: z.string(),
        name: z.string(),
        initialPassword: z.string(),
      }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
      409: platformErrorSchema,
    },
    summary: "Create workspace admin user from platform console",
  },
} as const;

export const platformWorkspacesContract = c.router(platformWorkspacesRoutes);

// Settings
export const platformSettingsRoutes = {
  getSettings: {
    method: "GET",
    path: "/api/platform/settings",
    responses: {
      200: z.object({ settings: platformSettingsSchema }),
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Get global platform settings",
  },
  updateSettings: {
    method: "PUT",
    path: "/api/platform/settings",
    body: platformSettingsUpdateSchema,
    responses: {
      200: z.object({ settings: platformSettingsSchema, success: z.literal(true) }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Update global platform settings",
  },
} as const;

export const platformSettingsContract = c.router(platformSettingsRoutes);

// Admins (users)
export const platformAdminsRoutes = {
  listAdmins: {
    method: "GET",
    path: "/api/platform/users",
    responses: {
      200: z.object({ users: z.array(platformUserProfileSchema) }),
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "List platform admins",
  },
  createAdmin: {
    method: "POST",
    path: "/api/platform/users",
    body: platformCreateAdminBodySchema,
    responses: {
      200: z.object({ user: platformUserProfileSchema }),
      201: z.object({ user: platformUserProfileSchema }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      409: platformErrorSchema,
    },
    summary: "Create a new platform admin",
  },
  updateAdminPermissions: {
    method: "PATCH",
    path: "/api/platform/users/:adminId/permissions",
    pathParams: z.object({ adminId: z.string() }),
    body: platformUpdateAdminPermissionsBodySchema,
    responses: {
      200: z.object({ user: platformUserProfileSchema }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Update admin permissions",
  },
  verifyAdminEmail: {
    method: "POST",
    path: "/api/platform/users/:adminId/verify-email",
    pathParams: z.object({ adminId: z.string() }),
    body: z.unknown().optional(),
    responses: {
      200: z.object({ user: platformUserProfileSchema, success: z.literal(true) }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Verify platform admin email",
  },
  setAdminDisabled: {
    method: "PATCH",
    path: "/api/platform/users/:adminId/disabled",
    pathParams: z.object({ adminId: z.string() }),
    body: platformAdminDisabledBodySchema,
    responses: {
      200: z.object({ user: platformUserProfileSchema }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Enable or disable a platform admin",
  },
  deleteAdmin: {
    method: "DELETE",
    path: "/api/platform/users/:adminId",
    pathParams: z.object({ adminId: z.string() }),
    body: platformDeleteAdminBodySchema,
    responses: {
      200: z.object({ deleted: z.literal(true), id: z.string() }),
      400: platformErrorSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
      404: platformErrorSchema,
    },
    summary: "Delete a platform admin",
  },
} as const;

export const platformAdminsContract = c.router(platformAdminsRoutes);

export const platformContract = c.router({
  // Auth
  login: {
    method: "POST",
    path: "/api/platform/auth/login",
    body: loginBodySchema,
    responses: {
      200: platformLoginResponseSchema,
      401: platformErrorSchema,
      503: platformErrorSchema,
    },
    summary: "Platform admin login",
  },
  verifyTwoFactor: {
    method: "POST",
    path: "/api/platform/auth/2fa/verify",
    body: challengeCodeBodySchema,
    responses: {
      200: z.object({ user: platformUserSchema }),
      401: platformErrorSchema,
    },
    summary: "Verify platform two-factor authentication challenge",
  },
  resendTwoFactor: {
    method: "POST",
    path: "/api/platform/auth/2fa/resend",
    body: challengeIdBodySchema,
    responses: {
      200: z.object({ success: z.boolean() }),
      404: platformErrorSchema,
    },
    summary: "Resend platform two-factor challenge",
  },
  getSetupStatus: {
    method: "GET",
    path: "/api/platform/auth/setup/status",
    responses: {
      200: platformSetupStatusSchema,
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Get platform setup status",
  },
  setupRegister: {
    method: "POST",
    path: "/api/platform/auth/setup/register",
    body: platformSetupRegisterBodySchema,
    responses: {
      200: z.object({ user: platformUserSchema }),
      400: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Register first super-user",
  },
  passwordForgot: {
    method: "POST",
    path: "/api/platform/auth/password/forgot",
    body: platformPasswordForgotBodySchema,
    responses: {
      200: z.object({
        accepted: z.literal(true),
        devReset: z.object({ resetId: z.string(), code: z.string() }).optional(),
      }),
      400: platformErrorSchema,
    },
    summary: "Request platform password reset",
  },
  passwordReset: {
    method: "POST",
    path: "/api/platform/auth/password/reset",
    body: platformPasswordResetBodySchema,
    responses: {
      200: z.object({ user: platformUserSchema }),
      400: platformErrorSchema,
    },
    summary: "Complete platform password reset",
  },
  passwordResend: {
    method: "POST",
    path: "/api/platform/auth/password/resend",
    body: platformPasswordResendBodySchema,
    responses: {
      200: z.object({ accepted: z.literal(true) }),
      400: platformErrorSchema,
    },
    summary: "Resend platform password reset code",
  },
  // Profile
  getMe: {
    method: "GET",
    path: "/api/platform/auth/me",
    responses: {
      200: z.object({ user: platformUserProfileSchema.nullable(), isAuthenticated: z.boolean() }),
      401: platformErrorSchema,
    },
    summary: "Get platform user profile",
  },
  patchMe: {
    method: "PATCH",
    path: "/api/platform/auth/me",
    body: platformProfilePatchBodySchema,
    responses: {
      200: z.object({ user: platformUserProfileSchema }),
      400: platformErrorSchema,
      401: platformErrorSchema,
    },
    summary: "Update platform user profile",
  },
  changePassword: {
    method: "POST",
    path: "/api/platform/auth/change-password",
    body: platformChangePasswordBodySchema,
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: platformErrorSchema,
      401: platformErrorSchema,
    },
    summary: "Change platform user password",
  },
  // Settings
  ...platformSettingsRoutes,
  // System admin
  migrateAndRestart: {
    method: "POST",
    path: "/api/platform/admin/system/migrate-and-restart",
    body: migrateAndRestartSchema,
    responses: {
      202: migrateAndRestartAcceptedSchema,
      400: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Apply Drizzle migrations and reload backend",
  },
  getActivityLogs: {
    method: "GET",
    path: "/api/platform/admin/system/activity-logs",
    query: platformActivityLogsQuerySchema,
    responses: {
      200: z.object({ logs: z.array(platformActivityLogSchema) }),
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Get super-user activity logs",
  },
  // Workspaces
  ...platformWorkspacesRoutes,
  // Admins (users)
  ...platformAdminsRoutes,
});
