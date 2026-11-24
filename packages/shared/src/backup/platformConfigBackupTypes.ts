/** Platform-configuration backup snapshot contracts (settings + branding; no secrets). */
import { z } from "zod";
import { platformBrandingUpdateSchema } from "../branding/platformBrandingTypes.js";
import { DATE_FORMAT_PRESET_IDS } from "../core/dateFormatPresets.js";
import { isValidIanaTimezone } from "../core/timezoneCore.js";
import { SYSTEM_MODULES_BY_ID } from "../settings/globalSettingsModuleRegistry.js";
import { THEME_MODE_VALUES } from "../settings/globalSettingsThemeUtils.js";

/** Versioned snapshot wrapper for an encrypted platform-configuration backup. */
export const PLATFORM_CONFIG_BACKUP_FORMAT = "mms-platform-config-backup" as const;
export const PLATFORM_CONFIG_BACKUP_VERSION = 1;

const moduleIdSchema = z
  .string()
  .refine((id) => SYSTEM_MODULES_BY_ID[id] !== undefined, "Unknown module id");

/** Non-secret platform settings captured in a configuration backup. */
export const platformConfigBackupSettingsSchema = z
  .object({
    syncTlsOnCreate: z.boolean().optional(),
    tlsExtraSans: z.string().optional(),
    certbotEmail: z.string().optional(),
    emailNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    whatsAppNotifications: z.boolean().optional(),
    timezone: z
      .string()
      .refine((value) => isValidIanaTimezone(value), "Invalid IANA timezone")
      .optional(),
    dateFormat: z.enum(DATE_FORMAT_PRESET_IDS).optional(),
    themeMode: z.enum(THEME_MODE_VALUES).optional(),
    defaultEnabledModules: z.record(z.string(), z.boolean()).optional(),
    disabledModules: z.array(moduleIdSchema).optional(),
    idleSessionMinutes: z.number().int().min(5).max(480).optional(),
  })
  .strict();

export const platformConfigBackupWorkspaceSchema = z
  .object({
    subdomain: z.string().min(1).max(63),
    name: z.string().max(200).optional(),
    enabled: z.boolean().optional(),
    createdAt: z.string().optional(),
  })
  .strict();

export const platformConfigBackupAdminSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().max(200).optional(),
    email: z.string().max(255),
    role: z.enum(["super_user", "admin"]).optional(),
    permissions: z.record(z.string(), z.boolean()).optional(),
    disabled: z.boolean().optional(),
  })
  .strict();

/** Strict snapshot schema validated before any platform-configuration restore. */
export const platformConfigBackupSnapshotSchema = z
  .object({
    format: z.literal(PLATFORM_CONFIG_BACKUP_FORMAT),
    version: z.literal(PLATFORM_CONFIG_BACKUP_VERSION),
    exportedAt: z.string(),
    settings: platformConfigBackupSettingsSchema.optional(),
    branding: platformBrandingUpdateSchema.optional(),
    workspaces: z.array(platformConfigBackupWorkspaceSchema).max(10_000).optional(),
    admins: z.array(platformConfigBackupAdminSchema).max(1_000).optional(),
  })
  .strict();

export type PlatformConfigBackupSnapshot = z.infer<typeof platformConfigBackupSnapshotSchema>;

/** Response of a platform-configuration import (applied vs. reported-only sections). */
export interface PlatformConfigBackupApplyResult {
  applied: { settings: boolean; branding: boolean };
  notApplied: { workspaces: number; admins: number };
  warnings: string[];
}

export const platformConfigBackupApplyResultSchema = z
  .object({
    applied: z.object({ settings: z.boolean(), branding: z.boolean() }).strict(),
    notApplied: z
      .object({
        workspaces: z.number().int().nonnegative(),
        admins: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(z.string()),
  })
  .strict();
