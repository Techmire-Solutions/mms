import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ownContactPatchBodySchema } from "../schemas/profile.dto.js";
import { contactRecordSchema } from "../contactsModuleManifest.js";

const c = initContract();

export const tenantUserProfileContractSchema = z.object({
  id: z.string(),
  loginEmail: z.string(),
  emailVerifiedAt: z.string().optional(),
  name: z.string(),
  role: z.string(),
  workspaceSubdomain: z.string(),
  contactId: z.union([z.string(), z.number()]).optional(),
  contact: contactRecordSchema.nullable(),
  pendingLoginEmail: z.string().optional(),
});

export const profileContract = c.router({
  getProfile: {
    method: "GET",
    path: "/api/auth/profile",
    responses: {
      200: z.object({
        profile: tenantUserProfileContractSchema,
      }),
      401: z.unknown(),
      404: z.unknown(),
    },
    summary: "Get current user profile",
  },
  updateContact: {
    method: "PUT",
    path: "/api/auth/me/contact",
    body: ownContactPatchBodySchema,
    responses: {
      200: z.object({
        success: z.boolean().optional(),
        contact: contactRecordSchema.optional(),
      }),
      400: z.unknown(),
      401: z.unknown(),
      403: z.unknown(),
      404: z.unknown(),
    },
    summary: "Update own contact profile",
  },
});
