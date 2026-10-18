import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { usersListQuerySchema } from "../auth/usersListQuery.js";
import {
  activityLogRecordSchema,
  createWorkspaceUserSchema,
  editWorkspaceUserSchema,
  inviteWorkspaceUserSchema,
  resetWorkspaceUserPasswordSchema,
  workspaceUserRecordSchema,
} from "../auth/usersModuleManifest.js";

const c = initContract();
const errorResponse = z.unknown();

/** Envelope for paginated workspace-user list responses (`UsersListPageResult`). */
export const userListPageResponseSchema = z.object({
  users: z.array(workspaceUserRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
const userBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

export const userContract = c.router({
  list: {
    method: "GET",
    path: "/api/users",
    query: usersListQuerySchema,
    responses: {
      200: userListPageResponseSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "List workspace users",
  },
  create: {
    method: "POST",
    path: "/api/users",
    body: createWorkspaceUserSchema.or(workspaceUserRecordSchema),
    responses: {
      200: z.object({
        user: workspaceUserRecordSchema,
        inviteEmailSent: z.boolean().optional(),
        inviteEmailError: z.string().optional(),
      }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Create a single workspace user",
  },
  update: {
    method: "PATCH",
    path: "/api/users/:id",
    pathParams: z.object({ id: z.string().min(1) }),
    body: editWorkspaceUserSchema.partial(),
    responses: {
      200: z.object({ user: workspaceUserRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Update a single workspace user",
  },
  invite: {
    method: "POST",
    path: "/api/users/invite",
    body: inviteWorkspaceUserSchema,
    responses: {
      200: z.object({
        user: workspaceUserRecordSchema,
        inviteEmailSent: z.boolean().optional(),
        inviteEmailError: z.string().optional(),
      }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Invite a workspace user",
  },
  activity: {
    method: "GET",
    path: "/api/users/activity",
    responses: {
      200: z.object({ logs: z.array(activityLogRecordSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List user activity logs",
  },
  activityBulkUpdate: {
    method: "PUT",
    path: "/api/users/activity/bulk",
    body: z.array(activityLogRecordSchema),
    responses: {
      200: z.object({ logs: z.array(activityLogRecordSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk upsert activity logs",
  },
  exportAudit: {
    method: "POST",
    path: "/api/users/export-audit",
    body: z.object({ count: z.number(), scope: z.string() }),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Log export audit",
  },
  bulkUpdate: {
    method: "PUT",
    path: "/api/users/bulk",
    body: z.array(workspaceUserRecordSchema),
    responses: {
      200: z.object({ users: z.array(workspaceUserRecordSchema) }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk upsert workspace users",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/users/bulk-delete",
    body: z.object({ ids: z.array(z.string()) }),
    responses: {
      200: userBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk soft-delete users",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/users/bulk-restore",
    body: z.object({ ids: z.array(z.string()) }),
    responses: {
      200: userBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk restore users",
  },
  delete: {
    method: "DELETE",
    path: "/api/users/:id",
    body: z.unknown().optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Soft delete a user",
  },
  restore: {
    method: "POST",
    path: "/api/users/:id/restore",
    body: z.unknown().optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted user",
  },
  verifyEmail: {
    method: "POST",
    path: "/api/users/:id/verify-email",
    body: z.unknown().optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Manually verify a user email address",
  },

  resetPassword: {
    method: "POST",
    path: "/api/users/:id/reset-password",
    pathParams: z.object({ id: z.string().min(1) }),
    body: resetWorkspaceUserPasswordSchema,
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      429: errorResponse,
      500: errorResponse,
    },
    summary: "Issue a temporary password for a workspace user",
  },
  getFieldConfig: {
    method: "GET",
    path: "/api/users/config/fields",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/users/config/fields",
    body: z.unknown(),
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/users/config/preferences",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/users/config/preferences",
    body: z.unknown(),
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Update preferences",
  },
  getComposedConfig: {
    method: "GET",
    path: "/api/users/config/composed",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get composed config",
  },
});
