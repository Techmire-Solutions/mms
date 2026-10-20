import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  workspaceEnabledPatchBodySchema,
  platformWorkspaceModulesPatchBodySchema,
  workspaceEmailVerificationPatchBodySchema,
  workspaceDeleteBodySchema,
  workspaceResetAdminPasswordBodySchema,
  workspaceCreateAdminUserBodySchema,
  platformWorkspaceRowDtoSchema as platformWorkspaceRowSchema,
  platformWorkspacesListQuerySchema,
  platformWorkspacesListResponseSchema,
  platformWorkspaceMetricsDtoSchema,
  platformErrorDtoSchema as platformErrorSchema,
} from "../schemas/platform.dto.js";

const c = initContract();

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
