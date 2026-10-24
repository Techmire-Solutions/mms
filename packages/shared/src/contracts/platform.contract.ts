import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  platformSetupRegisterBodySchema,
  platformPasswordForgotBodySchema,
  platformPasswordResetBodySchema,
  platformPasswordResendBodySchema,
  platformProfilePatchBodySchema,
  platformChangePasswordBodySchema,
  platformActivityLogsQuerySchema,
  platformUserDtoSchema as platformUserSchema,
  platformUserProfileDtoSchema as platformUserProfileSchema,
  platformSetupStatusDtoSchema as platformSetupStatusSchema,
  platformSettingsDtoSchema as platformSettingsSchema,
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
import {
  platformAiQueryRequestSchema,
  platformAiQueryResponseSchema,
} from "../schemas/platformAi.dto.js";
import {
  platformWorkspacesRoutes,
  platformWorkspacesContract,
} from "./platformWorkspaces.contract.js";
import { platformAdminsRoutes, platformAdminsContract } from "./platformAdmins.contract.js";

export {
  platformWorkspacesRoutes,
  platformWorkspacesContract,
  platformAdminsRoutes,
  platformAdminsContract,
};

const c = initContract();

const migrateAndRestartAcceptedSchema = z.object({
  success: z.literal(true),
  accepted: z.literal(true),
  message: z.string(),
  delayMs: z.number(),
});

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
  // System admin — read/ops endpoints served by plain Fastify handlers
  // (platformAdminSystem.ts / platformAiRoutes.ts); declared here so the ts-rest client can reach them.
  getErd: {
    method: "GET",
    path: "/api/platform/schema/erd",
    responses: { 200: z.unknown(), 401: platformErrorSchema, 403: platformErrorSchema },
    summary: "Get the introspected schema ERD",
  },
  getTelemetry: {
    method: "GET",
    path: "/api/platform/admin/system/telemetry",
    responses: { 200: z.unknown(), 401: platformErrorSchema, 403: platformErrorSchema },
    summary: "Get platform system telemetry",
  },
  getActivityTrend: {
    method: "GET",
    path: "/api/platform/admin/system/activity-trend",
    responses: {
      200: z.object({ trend: z.array(z.unknown()) }),
      401: platformErrorSchema,
      403: platformErrorSchema,
    },
    summary: "Get platform activity trend",
  },
  aiQuery: {
    method: "POST",
    path: "/api/platform/ai/query",
    body: platformAiQueryRequestSchema,
    responses: {
      200: platformAiQueryResponseSchema,
      400: platformErrorSchema,
      403: platformErrorSchema,
      500: platformErrorSchema,
    },
    summary: "Run a platform AI diagnostics query",
  },
  getSessionPolicy: {
    method: "GET",
    path: "/api/platform/auth/session/policy",
    responses: { 200: z.unknown() },
    summary: "Get the platform session timeout policy",
  },
  // Workspaces
  ...platformWorkspacesRoutes,
  // Admins (users)
  ...platformAdminsRoutes,
});
