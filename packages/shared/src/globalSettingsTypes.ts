import type { AppTranslationKey } from "./appTranslations.js";
import { normalizeDateFormat, type DateFormatId } from "./dateFormatUtils.js";
import {
  normalizePasswordPolicy,
  normalizeSessionTimeout,
  normalizeThemeMode,
} from "./globalSettingsUtils.js";
import { normalizeAppLanguage, type AppLanguageCode } from "./languageUtils.js";
import { type LlmConfig, type LlmProviderType } from "./llmSettingsTypes.js";
import { normalizeTimezone } from "./timezoneUtils.js";

export type { AppLanguageCode };

// ─── Global Settings ──────────────────────────────────────────────────────────

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

/** Definition for an application module. */
export interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: "core" | "academic" | "admin" | "finance";
  required?: boolean;
}

/** All toggleable modules — ids align with sidebar `moduleId` in navConfig. */
export const SYSTEM_MODULES: ModuleDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Central overview and analytics",
    icon: "LayoutDashboard",
    category: "core",
    required: true,
  },
  {
    id: "contacts",
    label: "Contacts",
    description: "Comprehensive CRM directory",
    icon: "Users",
    category: "core",
    required: true,
  },
  {
    id: "messaging",
    label: "Messaging",
    description: "SMS, WhatsApp and announcements",
    icon: "MessageSquare",
    category: "core",
    required: true,
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Task delegation and tracking",
    icon: "CheckSquare",
    category: "core",
  },
  {
    id: "students",
    label: "Students",
    description: "Student directory and records",
    icon: "GraduationCap",
    category: "academic",
    required: true,
  },
  {
    id: "faculty",
    label: "Faculty",
    description: "Faculty directory and assignments",
    icon: "School",
    category: "academic",
  },
  {
    id: "sessions",
    label: "Sessions",
    description: "Classes, schedules and timetables",
    icon: "Calendar",
    category: "academic",
  },
  {
    id: "attendance",
    label: "Attendance",
    description: "Tracking and reporting",
    icon: "UserCheck",
    category: "academic",
  },
  {
    id: "enrollment",
    label: "Enrollments",
    description: "Student enrollment into sessions",
    icon: "ClipboardList",
    category: "academic",
  },
  {
    id: "hasanat",
    label: "Hasanat Cards",
    description: "Incentive and reward points",
    icon: "Star",
    category: "academic",
  },
  {
    id: "examination",
    label: "Examinations",
    description: "Testing and grading systems",
    icon: "FileText",
    category: "academic",
  },
  {
    id: "questionBank",
    label: "Question Bank",
    description: "Question repository and test papers",
    icon: "Library",
    category: "academic",
  },
  {
    id: "finance",
    label: "Finance",
    description: "Invoicing and fee management",
    icon: "DollarSign",
    category: "finance",
  },
  {
    id: "accounting",
    label: "Accounting",
    description: "General ledger and reports",
    icon: "TrendingUp",
    category: "finance",
  },
  {
    id: "obligations",
    label: "Obligations",
    description: "Religious obligations and funds",
    icon: "Scale",
    category: "finance",
  },
  {
    id: "users",
    label: "Users",
    description: "Role-based permissions and access",
    icon: "UserCog",
    category: "admin",
    required: true,
  },
];

/** Lookup map for module definitions by id. */
export const SYSTEM_MODULES_BY_ID: Record<string, ModuleDefinition> = Object.fromEntries(
  SYSTEM_MODULES.map((m) => [m.id, m]),
);

/** Standalone module entry in the system-modules settings nav. */
export interface SystemModuleNavItem {
  type: "module";
  moduleId: string;
}

/** Grouped modules — mirrors grouped sections in app navigation. */
export interface SystemModuleNavGroup {
  type: "group";
  labelKey: AppTranslationKey;
  icon: string;
  moduleIds: string[];
}

export type SystemModuleNavEntry = SystemModuleNavItem | SystemModuleNavGroup;

/**
 * Settings-page layout for system modules — mirrors `NAV_ITEMS` grouping:
 * standalone items plus an Academics group for academic sub-modules.
 */
export const SYSTEM_MODULE_NAV: SystemModuleNavEntry[] = [
  { type: "module", moduleId: "dashboard" },
  { type: "module", moduleId: "contacts" },
  { type: "module", moduleId: "tasks" },
  { type: "module", moduleId: "faculty" },
  { type: "module", moduleId: "messaging" },
  {
    type: "group",
    labelKey: "nav.academics",
    icon: "BookOpen",
    moduleIds: [
      "students",
      "sessions",
      "attendance",
      "enrollment",
      "hasanat",
      "examination",
      "questionBank",
    ],
  },
  { type: "module", moduleId: "finance" },
  { type: "module", moduleId: "accounting" },
  { type: "module", moduleId: "obligations" },
  { type: "module", moduleId: "users" },
];

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
