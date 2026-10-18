import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { MODULE_ACCESS_DENIAL_CODES } from "../settings/moduleAccessPolicy.js";

const c = initContract();

export const moduleAvailabilitySchema = z.object({
  granted: z.boolean(),
  enabled: z.boolean(),
});

export const moduleAccessResponseSchema = z.object({
  modules: z.record(z.string(), moduleAvailabilitySchema),
});
export type ModuleAccessResponse = z.infer<typeof moduleAccessResponseSchema>;

/** 403 body for module-gate denials: `type` keeps the error taxonomy, `code` is the stable reason. */
export const moduleAccessDeniedBodySchema = z.object({
  type: z.literal("forbidden"),
  code: z.enum(MODULE_ACCESS_DENIAL_CODES),
  moduleId: z.string(),
  message: z.string(),
});
export type ModuleAccessDeniedBody = z.infer<typeof moduleAccessDeniedBodySchema>;

export const moduleAccessContract = c.router({
  get: {
    method: "GET",
    path: "/api/module-access",
    responses: {
      200: moduleAccessResponseSchema,
      401: z.unknown(),
      403: z.unknown(),
      503: z.unknown(),
    },
    summary: "Platform grants and tenant enablement for every module in the current workspace",
  },
});
