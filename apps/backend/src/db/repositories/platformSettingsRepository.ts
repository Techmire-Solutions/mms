import { eq } from "drizzle-orm";
import {
  DEFAULT_PLATFORM_SETTINGS,
  mergePlatformSettings,
  type PlatformSettings,
} from "@mms/shared";
import { activeDb } from "../dbConnection.js";
import { platformSettings } from "../schema.js";
import {
  decryptLlmApiKey,
  decryptLlmConfigs,
  encryptLlmApiKey,
  encryptLlmConfigs,
} from "./workspaceLlmSecrets.js";

export const GLOBAL_SETTINGS_ID = "global";

/** Explicit projection — no wildcard selects (mms-performance). */
const platformSettingsColumns = {
  id: platformSettings.id,
  syncTlsOnCreate: platformSettings.syncTlsOnCreate,
  tlsExtraSans: platformSettings.tlsExtraSans,
  certbotEmail: platformSettings.certbotEmail,
  emailNotifications: platformSettings.emailNotifications,
  smsNotifications: platformSettings.smsNotifications,
  whatsAppNotifications: platformSettings.whatsAppNotifications,
  timezone: platformSettings.timezone,
  dateFormat: platformSettings.dateFormat,
  themeMode: platformSettings.themeMode,
  defaultEnabledModules: platformSettings.defaultEnabledModules,
  disabledModules: platformSettings.disabledModules,
  llmProvider: platformSettings.llmProvider,
  llmApiKey: platformSettings.llmApiKey,
  llmConfigs: platformSettings.llmConfigs,
  idleSessionMinutes: platformSettings.idleSessionMinutes,
  updatedAt: platformSettings.updatedAt,
};

type PlatformSettingsRowShape = {
  id: string;
  syncTlsOnCreate: boolean;
  tlsExtraSans: string;
  certbotEmail: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsAppNotifications: boolean;
  timezone: string;
  dateFormat: string;
  themeMode: string;
  defaultEnabledModules: Record<string, boolean> | null;
  disabledModules: string[] | null;
  llmProvider: string;
  llmApiKey: string | null;
  llmConfigs: Parameters<typeof decryptLlmConfigs>[0];
  idleSessionMinutes: number | null;
  updatedAt: Date | null;
};

function rowToPlatformSettings(row: PlatformSettingsRowShape): PlatformSettings {
  return mergePlatformSettings({
    id: row.id,
    syncTlsOnCreate: row.syncTlsOnCreate,
    tlsExtraSans: row.tlsExtraSans,
    certbotEmail: row.certbotEmail,
    emailNotifications: row.emailNotifications,
    smsNotifications: row.smsNotifications,
    whatsAppNotifications: row.whatsAppNotifications,
    timezone: row.timezone,
    dateFormat: row.dateFormat,
    themeMode: row.themeMode as PlatformSettings["themeMode"],
    defaultEnabledModules: row.defaultEnabledModules ?? undefined,
    disabledModules: row.disabledModules ?? undefined,
    llmProvider: row.llmProvider as PlatformSettings["llmProvider"],
    llmApiKey: decryptLlmApiKey(row.llmApiKey) ?? "",
    llmConfigs: decryptLlmConfigs(row.llmConfigs) ?? [],
    idleSessionMinutes: row.idleSessionMinutes ?? DEFAULT_PLATFORM_SETTINGS.idleSessionMinutes,
    ...(row.updatedAt ? { updatedAt: row.updatedAt.toISOString() } : {}),
  });
}

export async function findPlatformSettingsRow(
  id = GLOBAL_SETTINGS_ID,
): Promise<PlatformSettings | null> {
  const rows = await activeDb()
    .select(platformSettingsColumns)
    .from(platformSettings)
    .where(eq(platformSettings.id, id))
    .limit(1);

  return rows[0] ? rowToPlatformSettings(rows[0]) : null;
}

export async function insertPlatformSettingsDefaultRow(defaults: {
  id?: string;
  syncTlsOnCreate: boolean;
  tlsExtraSans: string;
  certbotEmail: string;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
}): Promise<PlatformSettings | null> {
  const inserted = await activeDb()
    .insert(platformSettings)
    .values({
      id: defaults.id || GLOBAL_SETTINGS_ID,
      syncTlsOnCreate: defaults.syncTlsOnCreate,
      tlsExtraSans: defaults.tlsExtraSans,
      certbotEmail: defaults.certbotEmail,
      emailNotifications: defaults.emailNotifications ?? true,
      smsNotifications: defaults.smsNotifications ?? false,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning(platformSettingsColumns);

  return inserted[0] ? rowToPlatformSettings(inserted[0]) : null;
}

/** Persists the full merged settings record (LLM secrets encrypted at rest). */
export async function upsertPlatformSettingsRow(
  next: PlatformSettings,
  id = GLOBAL_SETTINGS_ID,
): Promise<PlatformSettings> {
  const updatedAt = new Date();
  const values = {
    id,
    syncTlsOnCreate: next.syncTlsOnCreate,
    tlsExtraSans: next.tlsExtraSans.trim(),
    certbotEmail: next.certbotEmail.trim(),
    emailNotifications: next.emailNotifications,
    smsNotifications: next.smsNotifications,
    whatsAppNotifications: next.whatsAppNotifications,
    timezone: next.timezone,
    dateFormat: next.dateFormat,
    themeMode: next.themeMode,
    defaultEnabledModules: next.defaultEnabledModules,
    disabledModules: next.disabledModules,
    llmProvider: next.llmProvider,
    llmApiKey: encryptLlmApiKey(next.llmApiKey),
    llmConfigs: encryptLlmConfigs(next.llmConfigs),
    idleSessionMinutes: next.idleSessionMinutes,
    updatedAt,
  };

  await activeDb()
    .insert(platformSettings)
    .values(values)
    .onConflictDoUpdate({ target: platformSettings.id, set: values });

  return mergePlatformSettings({ ...next, id, updatedAt: updatedAt.toISOString() });
}
