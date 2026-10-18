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

const platformSetupRegisterBodyBaseSchema = z
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
  })
  .strict();

export const platformSetupRegisterBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformSetupRegisterBodyBaseSchema);

export type PlatformSetupRegisterInput = z.infer<typeof platformSetupRegisterBodyBaseSchema>;
export type PlatformSetupRegisterBody = PlatformSetupRegisterInput;

const platformSetupVerifyBodyBaseSchema = z
  .object({
    setupId: z.string().min(8),
    code: z.string().min(4).max(12),
  })
  .strict();

export const platformSetupVerifyBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformSetupVerifyBodyBaseSchema);

export type PlatformSetupVerifyInput = z.infer<typeof platformSetupVerifyBodyBaseSchema>;

const platformSetupResendBodyBaseSchema = z
  .object({
    setupId: z.string().min(8),
  })
  .strict();

export const platformSetupResendBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformSetupResendBodyBaseSchema);

export type PlatformSetupResendInput = z.infer<typeof platformSetupResendBodyBaseSchema>;

const platformPasswordForgotBodyBaseSchema = z
  .object({
    email: z.string().min(3),
  })
  .strict();

export const platformPasswordForgotBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformPasswordForgotBodyBaseSchema);

export type PlatformPasswordForgotInput = z.infer<typeof platformPasswordForgotBodyBaseSchema>;

const platformPasswordResetBodyBaseSchema = z
  .object({
    resetId: z.string().min(8),
    code: z.string().min(4).max(12),
    password: z.string().refine((val: string) => !validatePlatformSetupPassword(val), {
      message: "Password must be at least 10 characters long and contain both letters and numbers",
    }),
  })
  .strict();

export const platformPasswordResetBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformPasswordResetBodyBaseSchema);

export type PlatformPasswordResetInput = z.infer<typeof platformPasswordResetBodyBaseSchema>;
export type PlatformPasswordResetBody = PlatformPasswordResetInput;

const platformPasswordResendBodyBaseSchema = z
  .object({
    resetId: z.string().min(8),
  })
  .strict();

export const platformPasswordResendBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformPasswordResendBodyBaseSchema);

export type PlatformPasswordResendInput = z.infer<typeof platformPasswordResendBodyBaseSchema>;

const platformProfilePatchBodyBaseSchema = z
  .object({
    name: z
      .string()
      .refine((val: string) => !validatePlatformSetupName(val), {
        message: "Invalid display name",
      })
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164 format")
      .or(z.literal(""))
      .optional(),
  })
  .strict()
  .refine((val) => val.name !== undefined || val.phone !== undefined, {
    message: "At least one field is required",
  });

export const platformProfilePatchBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformProfilePatchBodyBaseSchema);

export type PlatformProfilePatchInput = z.infer<typeof platformProfilePatchBodyBaseSchema>;

const platformChangePasswordBodyBaseSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().refine((val: string) => !validatePlatformSetupPassword(val), {
      message: "Password must be at least 10 characters long and contain both letters and numbers",
    }),
  })
  .strict();

export const platformChangePasswordBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, platformChangePasswordBodyBaseSchema);

export type PlatformChangePasswordInput = z.infer<typeof platformChangePasswordBodyBaseSchema>;

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

export const platformActivityLogsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export type PlatformActivityLogsQueryInput = z.infer<typeof platformActivityLogsQuerySchema>;

export const platformUserDtoSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.enum(["super_user", "admin"]),
    permissions: platformAdminPermissionsSchema,
  })
  .strict();

export type PlatformUserDto = z.infer<typeof platformUserDtoSchema>;

export const platformUserProfileDtoSchema = platformUserDtoSchema
  .extend({
    createdAt: z.string().optional(),
    emailVerifiedAt: z.string().optional(),
    disabledAt: z.string().nullable().optional(),
  })
  .strict();

export type PlatformUserProfileDto = z.infer<typeof platformUserProfileDtoSchema>;

export const platformSetupStatusDtoSchema = z
  .object({
    needsSetup: z.boolean(),
    smtpConfigured: z.boolean(),
  })
  .strict();

export type PlatformSetupStatusDto = z.infer<typeof platformSetupStatusDtoSchema>;

export const platformSettingsDtoSchema = z.object({
  id: z.string(),
  syncTlsOnCreate: z.boolean(),
  tlsExtraSans: z.string().optional(),
  certbotEmail: z.string(),
  updatedAt: z.string().optional(),
});

export type PlatformSettingsDto = z.infer<typeof platformSettingsDtoSchema>;

export const platformWorkspaceRowDtoSchema = z
  .object({
    subdomain: z.string(),
    madrasaName: z.string().optional(),
    name: z.string().optional(),
    tagline: z.string().optional(),
    logoUrl: z.string().optional(),
    enabled: z.boolean(),
    createdAt: z.string(),
    requireEmailVerification: z.boolean().optional(),
    adminEmail: z.string().optional(),
  })
  .strict();

/** Keys intentionally omitted from platform workspace listings (secrets / settings). */
export const PLATFORM_WORKSPACE_ROW_SECRET_KEYS = [
  "llmApiKey",
  "llmConfigs",
  "llmProvider",
  "passwordHash",
] as const;

export type PlatformWorkspaceRowDto = z.infer<typeof platformWorkspaceRowDtoSchema>;

/** List query for platform workspace directory (paginated). */
export const platformWorkspacesListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().max(500).optional(),
    status: z.enum(["all", "active", "inactive"]).optional(),
    sortField: z.enum(["name", "subdomain", "createdAt", "status", "madrasaName"]).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

export type PlatformWorkspacesListQuery = z.infer<typeof platformWorkspacesListQuerySchema>;

export const platformWorkspacesListResponseSchema = z
  .object({
    workspaces: z.array(platformWorkspaceRowDtoSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
  })
  .strict();

export type PlatformWorkspacesListResponseDto = z.infer<
  typeof platformWorkspacesListResponseSchema
>;

export const platformWorkspaceMetricsDtoSchema = z
  .object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    inactive: z.number().int().nonnegative(),
  })
  .strict();

export type PlatformWorkspaceMetricsDto = z.infer<typeof platformWorkspaceMetricsDtoSchema>;

export const platformActivityLogDtoSchema = z
  .object({
    id: z.string(),
    userId: z.string().nullable(),
    userEmail: z.string(),
    action: z.string(),
    targetResource: z.string().nullable(),
    targetId: z.string().nullable(),
    ipAddress: z.string().nullable(),
    metadataMessage: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();

export type PlatformActivityLogDto = z.infer<typeof platformActivityLogDtoSchema>;

export const platformErrorDtoSchema = z
  .object({
    type: z.string(),
    message: z.string(),
  })
  .strict();

export type PlatformErrorDto = z.infer<typeof platformErrorDtoSchema>;
