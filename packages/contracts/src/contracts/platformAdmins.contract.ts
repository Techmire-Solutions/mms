import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  platformCreateAdminBodySchema,
  platformUpdateAdminPermissionsBodySchema,
  platformAdminDisabledBodySchema,
  platformDeleteAdminBodySchema,
  platformUserProfileDtoSchema as platformUserProfileSchema,
  platformErrorDtoSchema as platformErrorSchema,
} from "../schemas/platform.dto.js";

const c = initContract();

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
