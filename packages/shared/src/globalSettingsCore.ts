/** GlobalSettings shape, field-access keys, defaults, and merge/normalization. */
import { normalizeDateFormat, type DateFormatId } from "./dateFormatUtils.js";
import {
  normalizePasswordPolicy,
  normalizeSessionTimeout,
  normalizeThemeMode,
} from "./globalSettingsUtils.js";
import { normalizeAppLanguage, type AppLanguageCode } from "./languageUtils.js";
import { type LlmConfig, type LlmProviderType } from "./llmSettingsTypes.js";
import { normalizeTimezone } from "./timezoneUtils.js";
import { SYSTEM_MODULES } from "./globalSettingsModuleRegistry.js";

export type { AppLanguageCode };

/**
 * System-wide, cross-cutting configuration that applies to the whole application.
 * This is intentionally kept lean — domain-specific flags live in their own settings objects.
 */
export interface GlobalSettings {
  /** UI language code — see `APP_LANGUAGES` in `languageUtils`. */
  language: AppLanguageCode;
  /** IANA timezone string, e.g. "Asia/Karachi". */
  timezone: string;
  /** Display date format token, e.g. "DD/MM/YYYY". */
  dateFormat: string;
  /** Master toggle for email-based notifications. */
  emailNotifications: boolean;
  /** Master toggle for SMS-based notifications. */
  smsNotifications: boolean;
  /** Whether two-factor authentication is enforced. */
  twoFactor: boolean;
  /** Session inactivity timeout in minutes. */
  sessionTimeout: string;
  /** Password policy level. */
  passwordPolicy: "basic" | "medium" | "strong";
  /** UI colour theme preference. */
  theme: "light" | "dark" | "system";
  /** Map of module IDs to their enabled status. */
  enabledModules: Record<string, boolean>;
  /** The chosen LLM provider. */
  llmProvider: LlmProviderType | "none";
  /** The user's LLM API key. */
  llmApiKey: string;
  /** Dynamic list of multiple LLM configurations. */
  llmConfigs: LlmConfig[];
}

/** Fields any authenticated tenant user may read and write (Language & Region, Theme mode). */
export const GLOBAL_SETTINGS_PUBLIC_FIELD_KEYS = [
  "language",
  "timezone",
  "dateFormat",
  "theme",
] as const satisfies readonly (keyof GlobalSettings)[];

/** Fields restricted to `settings.global.write` (Notifications, Security, AI assistance, System Modules). */
export const GLOBAL_SETTINGS_ADMIN_FIELD_KEYS = [
  "emailNotifications",
  "smsNotifications",
  "twoFactor",
  "sessionTimeout",
  "passwordPolicy",
  "enabledModules",
  "llmProvider",
  "llmApiKey",
  "llmConfigs",
] as const satisfies readonly (keyof GlobalSettings)[];

/** Authoritative default values for GlobalSettings.
 * `enabledModules` is derived from `SYSTEM_MODULES` so it can never drift from the registry.
 */
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  language: "en",
  timezone: "Asia/Karachi",
  dateFormat: "DD/MM/YYYY",
  emailNotifications: true,
  smsNotifications: false,
  twoFactor: false,
  sessionTimeout: "60",
  passwordPolicy: "strong",
  theme: "system",
  enabledModules: Object.fromEntries(SYSTEM_MODULES.map((m) => [m.id, true])),
  llmProvider: "none",
  llmApiKey: "",
  llmConfigs: [],
};

/**
 * Merges module visibility flags with defaults; required modules always stay enabled.
 */
export function normalizeEnabledModules(
  partial?: Record<string, boolean> | null,
): Record<string, boolean> {
  const incoming = { ...(partial ?? {}) };

  const merged: Record<string, boolean> = {
    ...DEFAULT_GLOBAL_SETTINGS.enabledModules,
    ...incoming,
  };
  // Required modules are always on, regardless of stored value.
  for (const mod of SYSTEM_MODULES) {
    if (mod.required) merged[mod.id] = true;
  }
  return merged;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

/**
 * Deep-merges stored global settings with defaults (including `enabledModules` keys).
 */
export function mergeGlobalSettings(partial?: Partial<GlobalSettings> | null): GlobalSettings {
  const sessionTimeout = normalizeSessionTimeout(
    partial?.sessionTimeout ?? DEFAULT_GLOBAL_SETTINGS.sessionTimeout,
  );
  const passwordPolicy = normalizePasswordPolicy(
    partial?.passwordPolicy ?? DEFAULT_GLOBAL_SETTINGS.passwordPolicy,
  );
  const timezone = normalizeTimezone(partial?.timezone, DEFAULT_GLOBAL_SETTINGS.timezone);
  const dateFormat = normalizeDateFormat(
    partial?.dateFormat,
    DEFAULT_GLOBAL_SETTINGS.dateFormat as DateFormatId,
  );
  const theme = normalizeThemeMode(partial?.theme ?? DEFAULT_GLOBAL_SETTINGS.theme);

  return {
    ...DEFAULT_GLOBAL_SETTINGS,
    ...partial,
    language: normalizeAppLanguage(partial?.language),
    timezone,
    dateFormat,
    theme,
    emailNotifications: coerceBoolean(
      partial?.emailNotifications,
      DEFAULT_GLOBAL_SETTINGS.emailNotifications,
    ),
    smsNotifications: coerceBoolean(
      partial?.smsNotifications,
      DEFAULT_GLOBAL_SETTINGS.smsNotifications,
    ),
    twoFactor: coerceBoolean(partial?.twoFactor, DEFAULT_GLOBAL_SETTINGS.twoFactor),
    sessionTimeout,
    passwordPolicy,
    enabledModules: normalizeEnabledModules(partial?.enabledModules),
    llmProvider: partial?.llmProvider ?? DEFAULT_GLOBAL_SETTINGS.llmProvider,
    llmApiKey: partial?.llmApiKey ?? DEFAULT_GLOBAL_SETTINGS.llmApiKey,
    llmConfigs: Array.isArray(partial?.llmConfigs)
      ? partial.llmConfigs
      : DEFAULT_GLOBAL_SETTINGS.llmConfigs,
  };
}
