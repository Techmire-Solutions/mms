import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";
import { TENANT_AUTH_ERROR_TYPES, type User } from "../auth/tenantAuthTypes.js";
import { workspaceUserRecordSchema } from "../auth/usersModuleManifest.js";
import { platformUserProfileDtoSchema } from "./platform.dto.js";
import type { PlatformUserProfile } from "../auth/platformTypes.js";

const onboardBodyBaseSchema = z
  .object({
    madrasaName: z.string().min(1),
    adminName: z.string().min(1),
    email: z.string().min(3),
    password: z.string().min(6),
    /** Platform operator password step-up (caller must hold platform session). */
    currentPassword: z.string().min(1),
    subdomain: z.string().min(2),
    tagline: z.string().optional(),
    country: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    logoUrl: z.string().optional(),
    adminPhone: z.string().optional(),
    website: z.string().optional(),
    footerText: z.string().optional(),
    // Extended Institution Fields
    faviconUrl: z.string().optional(),
    legalName: z.string().optional(),
    registrationNumber: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    postalCode: z.string().optional(),
    socialLinks: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
    modules: z.array(z.string()).optional(),
    industryType: z.string().optional(),
  })
  .strict();

export const onboardBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, onboardBodyBaseSchema);

const loginBodyBaseSchema = z
  .object({
    email: z.string().min(3),
    password: z.string().min(6),
  })
  .strict();

export const loginBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, loginBodyBaseSchema);

const challengeCodeBodyBaseSchema = z
  .object({
    challengeId: z.string().min(1),
    code: z.string().min(1),
  })
  .strict();

export const challengeCodeBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, challengeCodeBodyBaseSchema);

const challengeIdBodyBaseSchema = z
  .object({
    challengeId: z.string().min(1),
  })
  .strict();

export const challengeIdBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, challengeIdBodyBaseSchema);

const handoffBodyBaseSchema = z
  .object({
    code: z.string().min(1),
  })
  .strict();

export const handoffBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, handoffBodyBaseSchema);

export type HandoffBody = z.infer<typeof handoffBodySchema>;

export const tenantAuthErrorSchema = z.object({
  type: z.enum(TENANT_AUTH_ERROR_TYPES),
  message: z.string(),
});
export type TenantAuthError = z.infer<typeof tenantAuthErrorSchema>;

export const tenantLoginResponseSchema = z.object({
  user: workspaceUserRecordSchema,
  requires2FA: z.boolean(),
  challengeId: z.string().optional(),
});

export interface TenantLoginResponse {
  user: User;
  requires2FA: boolean;
  challengeId?: string;
}

export const platformLoginResponseSchema = z.object({
  user: platformUserProfileDtoSchema,
  requires2FA: z.boolean().optional(),
  challengeId: z.string().optional(),
});

export interface PlatformLoginResponse {
  user: PlatformUserProfile;
  requires2FA?: boolean;
  challengeId?: string;
}
