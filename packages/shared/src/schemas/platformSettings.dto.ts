import { z } from "zod";
import { LLM_PROVIDER_KEYS, llmConfigInputSchema } from "../auth/llmSettingsTypes.js";
import { platformBrandingUpdateSchema } from "../branding/platformBrandingTypes.js";
import { DATE_FORMAT_PRESET_IDS } from "../core/dateFormatPresets.js";
import { THEME_MODE_VALUES } from "../settings/globalSettingsThemeUtils.js";
import { platformConfigBackupApplyResultSchema } from "../backup/platformConfigBackupTypes.js";
import { SYSTEM_MODULES_BY_ID } from "../settings/globalSettingsModuleRegistry.js";
import { platformConsolidationPrefsSchema } from "../auth/platformSettingsTypes.js";

const platformModuleIdSchema = z
  .string()
  .refine((id) => SYSTEM_MODULES_BY_ID[id] !== undefined, "Unknown module id");

export const platformSettingsDtoSchema = z
  .object({
    id: z.string(),
    syncTlsOnCreate: z.boolean(),
    tlsExtraSans: z.string(),
    certbotEmail: z.string(),
    emailNotifications: z.boolean(),
    smsNotifications: z.boolean(),
    whatsAppNotifications: z.boolean(),
    timezone: z.string(),
    dateFormat: z.enum(DATE_FORMAT_PRESET_IDS),
    themeMode: z.enum(THEME_MODE_VALUES),
    defaultEnabledModules: z.record(z.string(), z.boolean()),
    disabledModules: z.array(z.string()),
    llmProvider: z.enum([...LLM_PROVIDER_KEYS, "none"]),
    llmApiKey: z.string(),
    llmConfigs: z.array(llmConfigInputSchema),
    consolidationPrefs: platformConsolidationPrefsSchema,
    idleSessionMinutes: z.number().int(),
    updatedAt: z.string().optional(),
  })
  .strict();

export type PlatformSettingsDto = z.infer<typeof platformSettingsDtoSchema>;

/** Full platform branding record returned to authenticated settings admins. */
export const platformBrandingDtoSchema = z
  .object({
    productName: z.string(),
    consoleTitle: z.string(),
    tagline: z.string(),
    primaryColor: z.string(),
    secondaryColor: z.string(),
    cornerStyle: z.string(),
    logoUrl: z.string(),
    faviconUrl: z.string(),
    footerText: z.string(),
    email: z.string(),
    phone: z.string(),
    website: z.string(),
    legalName: z.string(),
    registrationNumber: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string(),
    city: z.string(),
    region: z.string(),
    postalCode: z.string(),
    country: z.string(),
    socialLinks: z.array(z.object({ platform: z.string(), url: z.string() }).strict()).max(8),
    updatedAt: z.string().optional(),
  })
  .strict();

export type PlatformBrandingDto = z.infer<typeof platformBrandingDtoSchema>;

/** Public (unauthenticated) platform branding projection. */
export const platformPublicBrandingDtoSchema = z
  .object({
    productName: z.string(),
    consoleTitle: z.string(),
    tagline: z.string(),
    logoUrl: z.string(),
    faviconUrl: z.string(),
    primaryColor: z.string(),
    secondaryColor: z.string(),
    cornerStyle: z.string(),
    footerText: z.string(),
  })
  .strict();

export type PlatformPublicBrandingDto = z.infer<typeof platformPublicBrandingDtoSchema>;

/** Response of `GET /api/public/platform-branding` (boot-time white-label data). */
export const platformPublicBrandingResponseSchema = z
  .object({
    branding: platformPublicBrandingDtoSchema,
    themeMode: z.enum(THEME_MODE_VALUES),
    timezone: z.string(),
    dateFormat: z.enum(DATE_FORMAT_PRESET_IDS),
    updatedAt: z.string().optional(),
  })
  .strict();

export type PlatformPublicBrandingResponse = z.infer<typeof platformPublicBrandingResponseSchema>;

/** Body for `PUT /api/platform/branding` — identity/appearance + instance theme mode. */
export const platformBrandingSaveSchema = z
  .object({
    branding: platformBrandingUpdateSchema.optional(),
    themeMode: z.enum(THEME_MODE_VALUES).optional(),
    expectedUpdatedAt: z.string().optional(),
  })
  .strict()
  .refine((value) => value.branding !== undefined || value.themeMode !== undefined, {
    message: "At least one of branding or themeMode is required",
  });

export type PlatformBrandingSaveInput = z.infer<typeof platformBrandingSaveSchema>;

/** Catalog row for platform module availability/provisioning defaults. */
export const platformModuleCatalogEntryDtoSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    icon: z.string(),
    category: z.enum(["core", "academic", "admin", "finance"]),
    required: z.boolean().optional(),
    defaultEnabled: z.boolean(),
    platformEnabled: z.boolean(),
  })
  .strict();

export const platformModuleCatalogDtoSchema = z
  .object({ modules: z.array(platformModuleCatalogEntryDtoSchema) })
  .strict();

export type PlatformModuleCatalogDto = z.infer<typeof platformModuleCatalogDtoSchema>;

/** Body for `PUT /api/platform/modules`. */
export const platformModulesUpdateSchema = z
  .object({
    defaultEnabledModules: z.record(z.string(), z.boolean()),
    disabledModules: z.array(platformModuleIdSchema).max(64),
    expectedUpdatedAt: z.string().optional(),
  })
  .strict();

export type PlatformModulesUpdateInput = z.infer<typeof platformModulesUpdateSchema>;

/** Body for `PUT /api/platform/llm` (platform AI provider config). */
export const platformLlmUpdateSchema = z
  .object({
    llmProvider: z.enum([...LLM_PROVIDER_KEYS, "none"]).optional(),
    llmApiKey: z.string().max(4096).optional(),
    llmConfigs: z.array(llmConfigInputSchema).max(20).optional(),
    expectedUpdatedAt: z.string().optional(),
  })
  .strict();

export type PlatformLlmUpdateInput = z.infer<typeof platformLlmUpdateSchema>;

/** Body for platform LLM connectivity test / model discovery. */
export const platformLlmTestBodySchema = z
  .object({
    configId: z.string().min(1).optional(),
    prompt: z.string().max(2000).optional(),
    customConfig: llmConfigInputSchema.optional(),
  })
  .strict();

export type PlatformLlmTestBody = z.infer<typeof platformLlmTestBodySchema>;

/** Body for `POST /api/platform/backup/export`. */
export const platformBackupExportBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(1024),
  })
  .strict();

export type PlatformBackupExportInput = z.infer<typeof platformBackupExportBodySchema>;

export const platformBackupExportResponseSchema = z
  .object({
    fileName: z.string(),
    file: z.string(),
  })
  .strict();

export type PlatformBackupExportResponse = z.infer<typeof platformBackupExportResponseSchema>;

/** Body for `POST /api/platform/backup/import`. */
export const platformBackupImportBodySchema = z
  .object({
    file: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(1).max(1024),
    dryRun: z.boolean().optional(),
  })
  .strict();

export type PlatformBackupImportInput = z.infer<typeof platformBackupImportBodySchema>;

export { platformConfigBackupApplyResultSchema };

/** Platform web-app manifest built from branding (served to the browser). */
export const platformManifestDtoSchema = z
  .object({
    name: z.string(),
    short_name: z.string(),
    icons: z.array(
      z
        .object({
          src: z.string(),
          sizes: z.string(),
          type: z.string(),
        })
        .strict(),
    ),
    theme_color: z.string(),
    background_color: z.string(),
    display: z.literal("standalone"),
  })
  .strict();

export type PlatformManifestDto = z.infer<typeof platformManifestDtoSchema>;
