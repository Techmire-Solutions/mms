import { eq } from "drizzle-orm";
import { activeDb } from "../dbConnection.js";
import * as schema from "../schema.js";
import { type PlatformSmsIntegrationRow } from "../schema/platform.js";
import type { SmsIntegrationConfig, SmsIntegrationSecrets } from "@mms/shared";
import { DEFAULT_SMS_INTEGRATION } from "@mms/shared";

const SINGLETON_ID = "global";

export async function getPlatformSmsIntegrationRow(): Promise<PlatformSmsIntegrationRow | null> {
  const rows = await activeDb()
    .select({
      id: schema.platformSmsIntegrations.id,
      providerId: schema.platformSmsIntegrations.providerId,
      accountId: schema.platformSmsIntegrations.accountId,
      senderId: schema.platformSmsIntegrations.senderId,
      apiBaseUrl: schema.platformSmsIntegrations.apiBaseUrl,
      accountSecret: schema.platformSmsIntegrations.accountSecret,
      connected: schema.platformSmsIntegrations.connected,
      hasCredentials: schema.platformSmsIntegrations.hasCredentials,
      lastTestAt: schema.platformSmsIntegrations.lastTestAt,
      lastTestOk: schema.platformSmsIntegrations.lastTestOk,
      lastError: schema.platformSmsIntegrations.lastError,
      updatedAt: schema.platformSmsIntegrations.updatedAt,
    })
    .from(schema.platformSmsIntegrations)
    .where(eq(schema.platformSmsIntegrations.id, SINGLETON_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertPlatformSmsIntegrationConfigRow(
  config: SmsIntegrationConfig,
): Promise<void> {
  await activeDb()
    .insert(schema.platformSmsIntegrations)
    .values({
      id: SINGLETON_ID,
      providerId: config.providerId,
      accountId: config.accountId,
      senderId: config.senderId,
      apiBaseUrl: config.apiBaseUrl,
      connected: config.connected,
      hasCredentials: config.hasCredentials,
      lastTestAt: config.lastTestAt ? new Date(config.lastTestAt) : null,
      lastTestOk: config.lastTestOk ?? null,
      lastError: config.lastError,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.platformSmsIntegrations.id,
      set: {
        providerId: config.providerId,
        accountId: config.accountId,
        senderId: config.senderId,
        apiBaseUrl: config.apiBaseUrl,
        connected: config.connected,
        hasCredentials: config.hasCredentials,
        lastTestAt: config.lastTestAt ? new Date(config.lastTestAt) : null,
        lastTestOk: config.lastTestOk ?? null,
        lastError: config.lastError,
        updatedAt: new Date(),
      },
    });
}

export async function upsertPlatformSmsIntegrationSecretsRow(
  secrets: SmsIntegrationSecrets,
): Promise<void> {
  await activeDb()
    .insert(schema.platformSmsIntegrations)
    .values({
      id: SINGLETON_ID,
      providerId: DEFAULT_SMS_INTEGRATION.providerId,
      accountSecret: secrets.accountSecret,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.platformSmsIntegrations.id,
      set: {
        accountSecret: secrets.accountSecret,
        updatedAt: new Date(),
      },
    });
}
