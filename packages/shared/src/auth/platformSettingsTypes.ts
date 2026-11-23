/** Platform (apex) settings contracts, defaults, and validation. */
import { z } from "zod";
import {
  DATE_FORMAT_PRESET_IDS,
  normalizeDateFormat,
  type DateFormatId,
} from "../core/dateFormatPresets.js";
import { isValidIanaTimezone, normalizeTimezone } from "../core/timezoneCore.js";
import {
  LLM_PROVIDER_KEYS,
  llmConfigInputSchema,
  type LlmConfig,
  type LlmProviderType,
} from "./llmSettingsTypes.js";
import {
  normalizeThemeMode,
  THEME_MODE_VALUES,
  type ThemeMode,
} from "../settings/globalSettingsThemeUtils.js";
import { SYSTEM_MODULES, SYSTEM_MODULES_BY_ID } from "../settings/globalSettingsModuleRegistry.js";
import {
  normalizePlatformDefaultModules,
  normalizePlatformDisabledModules,
} from "../settings/platformModuleCatalog.js";
import { PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES } from "./platformTypes.js";

/** Minimum/maximum admin-editable platform idle timeout (minutes). */
export const PLATFORM_MIN_IDLE_SESSION_MINUTES = 5;
export const PLATFORM_MAX_IDLE_SESSION_MINUTES = 480;

export const platformConsolidationPrefsSchema = z
  .object({
    defaultPresentationCurrency: z.string().trim().regex(/^[A-Z]{3}$/, "Use a 3-letter ISO code"),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
  })
  .strict();

export type PlatformConsolidationPrefs = z.infer<typeof platformConsolidationPrefsSchema>;

export const DEFAULT_PLATFORM_CONSOLIDATION_PREFS: PlatformConsolidationPrefs = {
  defaultPresentationCurrency: "USD",
  fiscalYearStartMonth: 1,
};

export interface PlatformSettings {
  id: string;
  syncTlsOnCreate: boolean;
  tlsExtraSans: string;
  certbotEmail: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsAppNotifications: boolean;
  /** IANA timezone used for platform chrome/audit timestamps. */
  timezone: string;
  /** Display date format for platform chrome/audit timestamps. */
  dateFormat: string;
  /** Instance-default display mode for the apex console. */
  themeMode: ThemeMode;
  /** Modules enabled by default when provisioning a new workspace. */
  defaultEnabledModules: Record<string, boolean>;
  /** Modules unavailable platform-wide (feature flags); required modules excluded. */
  disabledModules: string[];
  /** Platform-level AI provider defaults. */
  llmProvider: LlmProviderType | "none";
  /** Masked in client responses; encrypted at rest. */
  llmApiKey: string;
  llmConfigs: LlmConfig[];
  /** Consolidation preferences (default presentation currency + fiscal year start). */
  consolidationPrefs: PlatformConsolidationPrefs;
  /** Apex idle session timeout (minutes); env remains the fallback. */
  idleSessionMinutes: number;
  updatedAt?: string;
}

const moduleIdSchema = z
  .string()
  .refine((id) => SYSTEM_MODULES_BY_ID[id] !== undefined, "Unknown module id");

export const platformSettingsUpdateSchema = z
  .object({
    syncTlsOnCreate: z.boolean().optional(),
    tlsExtraSans: z.string().optional(),
    certbotEmail: z.string().email("Valid email address required").or(z.literal("")).optional(),
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
    disabledModules: z.array(moduleIdSchema).max(SYSTEM_MODULES.length).optional(),
    llmProvider: z.enum([...LLM_PROVIDER_KEYS, "none"]).optional(),
    llmApiKey: z.string().max(4096).optional(),
    llmConfigs: z.array(llmConfigInputSchema).max(20).optional(),
    consolidationPrefs: platformConsolidationPrefsSchema.optional(),
    idleSessionMinutes: z
      .number()
      .int()
      .min(PLATFORM_MIN_IDLE_SESSION_MINUTES)
      .max(PLATFORM_MAX_IDLE_SESSION_MINUTES)
      .optional(),
    /** Optimistic-concurrency guard: 409 when the stored `updatedAt` differs. */
    expectedUpdatedAt: z.string().optional(),
  })
  .strict();

export type PlatformSettingsUpdateInput = z.infer<typeof platformSettingsUpdateSchema>;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  id: "global",
  syncTlsOnCreate: true,
  tlsExtraSans: "",
  certbotEmail: "",
  emailNotifications: true,
  smsNotifications: false,
  whatsAppNotifications: false,
  timezone: "UTC",
  dateFormat: "DD/MM/YYYY",
  themeMode: normalizeThemeMode("system"),
  defaultEnabledModules: normalizePlatformDefaultModules(null),
  disabledModules: [],
  llmProvider: "none",
  llmApiKey: "",
  llmConfigs: [],
  consolidationPrefs: DEFAULT_PLATFORM_CONSOLIDATION_PREFS,
  idleSessionMinutes: PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES,
};

/**
 * Merges stored platform settings with defaults. Guards against stale Redis
 * payloads written before a field existed (boot must never throw on shape drift).
 */
export function mergePlatformSettings(
  partial?: Partial<PlatformSettings> | null,
): PlatformSettings {
  const idle = Number(partial?.idleSessionMinutes);
  const idleSessionMinutes = Number.isFinite(idle)
    ? Math.min(
        Math.max(Math.round(idle), PLATFORM_MIN_IDLE_SESSION_MINUTES),
        PLATFORM_MAX_IDLE_SESSION_MINUTES,
      )
    : DEFAULT_PLATFORM_SETTINGS.idleSessionMinutes;

  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...(partial ?? {}),
    id: partial?.id ?? DEFAULT_PLATFORM_SETTINGS.id,
    syncTlsOnCreate: partial?.syncTlsOnCreate ?? DEFAULT_PLATFORM_SETTINGS.syncTlsOnCreate,
    tlsExtraSans: partial?.tlsExtraSans ?? DEFAULT_PLATFORM_SETTINGS.tlsExtraSans,
    certbotEmail: partial?.certbotEmail ?? DEFAULT_PLATFORM_SETTINGS.certbotEmail,
    emailNotifications: partial?.emailNotifications ?? DEFAULT_PLATFORM_SETTINGS.emailNotifications,
    smsNotifications: partial?.smsNotifications ?? DEFAULT_PLATFORM_SETTINGS.smsNotifications,
    whatsAppNotifications:
      partial?.whatsAppNotifications ?? DEFAULT_PLATFORM_SETTINGS.whatsAppNotifications,
    timezone: normalizeTimezone(partial?.timezone, DEFAULT_PLATFORM_SETTINGS.timezone),
    dateFormat: normalizeDateFormat(
      partial?.dateFormat,
      DEFAULT_PLATFORM_SETTINGS.dateFormat as DateFormatId,
    ),
    themeMode: normalizeThemeMode(partial?.themeMode ?? DEFAULT_PLATFORM_SETTINGS.themeMode),
    defaultEnabledModules: normalizePlatformDefaultModules(partial?.defaultEnabledModules),
    disabledModules: normalizePlatformDisabledModules(partial?.disabledModules),
    llmProvider: partial?.llmProvider ?? DEFAULT_PLATFORM_SETTINGS.llmProvider,
    llmApiKey: partial?.llmApiKey ?? DEFAULT_PLATFORM_SETTINGS.llmApiKey,
    llmConfigs: Array.isArray(partial?.llmConfigs)
      ? partial.llmConfigs
      : DEFAULT_PLATFORM_SETTINGS.llmConfigs,
    consolidationPrefs: platformConsolidationPrefsSchema.safeParse(partial?.consolidationPrefs).success
      ? (partial?.consolidationPrefs as PlatformConsolidationPrefs)
      : DEFAULT_PLATFORM_CONSOLIDATION_PREFS,
    idleSessionMinutes,
    ...(partial?.updatedAt === undefined ? {} : { updatedAt: partial.updatedAt }),
  };
}

export type PlatformNotificationChannel = "all" | "both" | "email" | "sms" | "whatsapp" | "none";

/** Primary outbound channel for platform 2FA/alerts — returns "both" when both are on. */
export function resolvePlatformNotificationChannel(
  settings: PlatformSettings,
): PlatformNotificationChannel {
  const email = Boolean(settings.emailNotifications);
  const sms = Boolean(settings.smsNotifications);
  const whatsapp = Boolean(settings.whatsAppNotifications);
  if (email && sms && whatsapp) return "all";
  if (email && sms) return "both";
  if (email) return "email";
  if (sms) return "sms";
  if (whatsapp) return "whatsapp";
  return "none";
}

/** Confirmation token for platform super-user migrate + process reload. */
export const MIGRATE_AND_RESTART_CONFIRM = "MIGRATE_AND_RESTART" as const;

/**
 * Body for `POST /api/platform/admin/system/migrate-and-restart`.
 * Requires current platform password step-up.
 */
export const migrateAndRestartSchema = z
  .object({
    confirm: z.literal(MIGRATE_AND_RESTART_CONFIRM, {
      message: `Confirmation string must be "${MIGRATE_AND_RESTART_CONFIRM}"`,
    }),
    password: z.string().min(1),
  })
  .strict();

export type MigrateAndRestartInput = z.infer<typeof migrateAndRestartSchema>;

/** Success body for `POST /api/platform/admin/system/migrate-and-restart`. */
export interface MigrateAndRestartAccepted {
  success: true;
  accepted: true;
  message: string;
  delayMs: number;
}
