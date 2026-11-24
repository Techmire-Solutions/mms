import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const workspaceSummarySchema = z.object({
  id: z.string(),
  subdomain: z.string(),
  madrasaName: z.string(),
  tagline: z.string().optional(),
  country: z.string().optional(),
  industryType: z.string().optional(),
  createdAt: z.string(),
  enabled: z.boolean().optional(),
});

export const publicWorkspaceSummarySchema = z.object({
  subdomain: z.string(),
  madrasaName: z.string(),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
});

export const workspaceContract = c.router({
  bySubdomain: {
    method: "GET",
    path: "/api/workspace/by-subdomain/:subdomain",
    pathParams: z.object({
      subdomain: z.string(),
    }),
    responses: {
      200: z.object({
        workspace: workspaceSummarySchema,
        branding: z.record(z.string(), z.unknown()).optional(),
      }),
      404: z.object({
        error: z.string(),
        code: z.string(),
      }),
    },
    summary: "Lookup workspace by subdomain",
  },
  publicBranding: {
    method: "GET",
    path: "/api/workspace/public-branding",
    responses: {
      200: z.object({
        branding: z.record(z.string(), z.unknown()).optional(),
      }),
      404: z.object({
        error: z.string(),
        code: z.string(),
      }),
    },
    summary: "Get public branding for current workspace",
  },
  registry: {
    method: "GET",
    path: "/api/workspace/registry",
    responses: {
      200: z.object({
        workspaces: z.array(publicWorkspaceSummarySchema),
      }),
      401: z.unknown(),
      403: z.unknown(),
    },
    summary: "Get apex workspace registry (apex-only)",
  },
});
