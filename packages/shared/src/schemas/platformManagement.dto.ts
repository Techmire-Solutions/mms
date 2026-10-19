import { z } from "zod";
import { DEFAULT_PLATFORM_ADMIN_PERMISSIONS } from "../auth/platformTypes.js";
import {
  validatePlatformSetupEmail,
  validatePlatformSetupName,
  validatePlatformSetupPassword,
} from "../auth/platformSetupValidation.js";
import { deepSanitizeStrings } from "./sanitize.js";

export const platformAdminPermissionsSchema = z
  .object({
    workspaces: z.boolean(),
    onboard: z.boolean(),
    settings: z.boolean(),
    admins: z.boolean(),
    system: z.boolean(),
  })
  .strict();

export type PlatformAdminPermissionsInput = z.infer<typeof platformAdminPermissionsSchema>;

const workspaceEnabledPatchBodyBaseSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const workspaceEnabledPatchBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, workspaceEnabledPatchBodyBaseSchema);

export type WorkspaceEnabledPatchInput = z.infer<typeof workspaceEnabledPatchBodyBaseSchema>;

const platformWorkspaceModulesPatchBodyBaseSchema = z
  .object({
    modules: z.array(z.string()),
  })
  .strict();

export const platformWorkspaceModulesPatchBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformWorkspaceModulesPatchBodyBaseSchema);

export type PlatformWorkspaceModulesPatchInput = z.infer<
  typeof platformWorkspaceModulesPatchBodyBaseSchema
>;

const workspaceEmailVerificationPatchBodyBaseSchema = z
  .object({
    requireEmailVerification: z.boolean(),
  })
  .strict();

export const workspaceEmailVerificationPatchBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, workspaceEmailVerificationPatchBodyBaseSchema);

export type WorkspaceEmailVerificationPatchInput = z.infer<
  typeof workspaceEmailVerificationPatchBodyBaseSchema
>;

const workspaceDeleteBodyBaseSchema = z
  .object({
    password: z.string().min(1),
    confirmSubdomain: z.string().min(1),
  })
  .strict();

export const workspaceDeleteBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, workspaceDeleteBodyBaseSchema);

export type WorkspaceDeleteInput = z.infer<typeof workspaceDeleteBodyBaseSchema>;

const workspaceResetAdminPasswordBodyBaseSchema = z
  .object({
    /** Platform operator password step-up. */
    password: z.string().min(1),
    newPassword: z.string().min(8).optional(),
  })
  .strict();

export const workspaceResetAdminPasswordBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, workspaceResetAdminPasswordBodyBaseSchema);

export type WorkspaceResetAdminPasswordInput = z.infer<
  typeof workspaceResetAdminPasswordBodyBaseSchema
>;

const workspaceCreateAdminUserBodyBaseSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    /** Optional initial password for the new tenant admin. */
    password: z.string().min(8).optional(),
    /** Platform operator password step-up. */
    currentPassword: z.string().min(1),
  })
  .strict();

export const workspaceCreateAdminUserBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, workspaceCreateAdminUserBodyBaseSchema);

export type WorkspaceCreateAdminUserInput = z.infer<typeof workspaceCreateAdminUserBodyBaseSchema>;

const platformCreateAdminBodyBaseSchema = z
  .object({
    name: z.string().refine((val: string) => !validatePlatformSetupName(val), {
      message: "Invalid display name",
    }),
    email: z.string().refine((val: string) => !validatePlatformSetupEmail(val), {
      message: "Invalid email address",
    }),
    password: z.string().refine((val: string) => !validatePlatformSetupPassword(val), {
      message: "Password must be at least 10 characters long and contain both letters and numbers",
    }),
    /** Platform operator password step-up. */
    currentPassword: z.string().min(1),
    permissions: platformAdminPermissionsSchema.default(DEFAULT_PLATFORM_ADMIN_PERMISSIONS),
  })
  .strict();

export const platformCreateAdminBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformCreateAdminBodyBaseSchema);

export type PlatformCreateAdminInput = z.infer<typeof platformCreateAdminBodyBaseSchema>;

const platformUpdateAdminPermissionsBodyBaseSchema = z
  .object({
    permissions: platformAdminPermissionsSchema,
    /** Platform operator password step-up. */
    password: z.string().min(1),
  })
  .strict();

export const platformUpdateAdminPermissionsBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformUpdateAdminPermissionsBodyBaseSchema);

export type PlatformUpdateAdminPermissionsInput = z.infer<
  typeof platformUpdateAdminPermissionsBodyBaseSchema
>;

const platformAdminDisabledBodyBaseSchema = z
  .object({
    disabled: z.boolean(),
    password: z.string().min(1),
  })
  .strict();

export const platformAdminDisabledBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformAdminDisabledBodyBaseSchema);

export type PlatformAdminDisabledInput = z.infer<typeof platformAdminDisabledBodyBaseSchema>;

const platformDeleteAdminBodyBaseSchema = z
  .object({
    password: z.string().min(1),
  })
  .strict();

export const platformDeleteAdminBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformDeleteAdminBodyBaseSchema);

export type PlatformDeleteAdminInput = z.infer<typeof platformDeleteAdminBodyBaseSchema>;
