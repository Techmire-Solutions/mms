import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { userStatusSchema } from "../auth/usersModuleManifest.js";

const c = initContract();
const errorResponse = z.unknown();

export const platformIamSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
});

export const platformIamMemberSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  status: userStatusSchema,
});

export const platformIamUserResultSchema = z.object({
  tenant: z.string(),
  user: platformIamMemberSummarySchema,
});

export const platformIamUserSearchResponseSchema = z.object({
  items: z.array(platformIamUserResultSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export const platformIamOrgResultSchema = z.object({
  subdomain: z.string(),
  madrasaName: z.string(),
  enabled: z.boolean(),
});

export const platformIamOrgSearchResponseSchema = z.object({
  items: z.array(platformIamOrgResultSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export const platformIamSetUserStatusBodySchema = z
  .object({
    status: z.enum(["active", "suspended"]),
    reason: z.string().trim().min(10).max(500),
    currentPassword: z.string().min(1),
  })
  .strict();

export const platformIamImpersonationBodySchema = z
  .object({
    tenant: z.string().trim().min(1).max(100),
    userId: z.string().trim().min(1).max(100),
    reason: z.string().trim().min(10).max(500),
    currentPassword: z.string().min(1),
  })
  .strict();

export const platformIamImpersonationResponseSchema = z.object({
  handoffUrl: z.string().url(),
  expiresAt: z.string(),
  auditId: z.string(),
});

export const platformIamContract = c.router({
  searchUsers: {
    method: "GET",
    path: "/api/platform/iam/users",
    query: platformIamSearchQuerySchema,
    responses: {
      200: platformIamUserSearchResponseSchema,
      401: errorResponse,
      403: errorResponse,
    },
    summary: "Cross-tenant user search (platform IAM)",
  },
  searchOrganizations: {
    method: "GET",
    path: "/api/platform/iam/organizations",
    query: platformIamSearchQuerySchema,
    responses: {
      200: platformIamOrgSearchResponseSchema,
      401: errorResponse,
      403: errorResponse,
    },
    summary: "Cross-tenant organization search (platform IAM)",
  },
  setUserStatus: {
    method: "PATCH",
    path: "/api/platform/iam/users/:tenant/:userId/status",
    pathParams: z.object({ tenant: z.string().min(1), userId: z.string().min(1) }),
    body: platformIamSetUserStatusBodySchema,
    responses: {
      200: z.object({ tenant: z.string(), user: platformIamMemberSummarySchema }),
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
    summary: "Suspend or reactivate a tenant user (platform IAM)",
  },
  beginImpersonation: {
    method: "POST",
    path: "/api/platform/iam/impersonations",
    body: platformIamImpersonationBodySchema,
    responses: {
      200: platformIamImpersonationResponseSchema,
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
    summary: "Start an audited, short-lived tenant impersonation",
  },
});

export type PlatformIamSearchQuery = z.infer<typeof platformIamSearchQuerySchema>;
export type PlatformIamImpersonationBody = z.infer<typeof platformIamImpersonationBodySchema>;
