import { eq } from "drizzle-orm";
import { activeDb } from "../dbConnection.js";
import * as schema from "../schema.js";
import { type PlatformEmailIntegrationRow } from "../schema/platform.js";
import type { EmailIntegrationConfig, EmailIntegrationSecrets } from "@mms/shared";
import { DEFAULT_EMAIL_INTEGRATION } from "@mms/shared";

const SINGLETON_ID = "global";

export async function getPlatformEmailIntegrationRow(): Promise<PlatformEmailIntegrationRow | null> {
  const rows = await activeDb()
    .select({
      id: schema.platformEmailIntegrations.id,
      providerId: schema.platformEmailIntegrations.providerId,
      fromAddress: schema.platformEmailIntegrations.fromAddress,
      fromName: schema.platformEmailIntegrations.fromName,
      smtpUsername: schema.platformEmailIntegrations.smtpUsername,
      smtpHost: schema.platformEmailIntegrations.smtpHost,
      smtpPort: schema.platformEmailIntegrations.smtpPort,
      smtpSecure: schema.platformEmailIntegrations.smtpSecure,
      smtpPassword: schema.platformEmailIntegrations.smtpPassword,
      connected: schema.platformEmailIntegrations.connected,
      hasCredentials: schema.platformEmailIntegrations.hasCredentials,
      lastTestAt: schema.platformEmailIntegrations.lastTestAt,
      lastTestOk: schema.platformEmailIntegrations.lastTestOk,
      lastError: schema.platformEmailIntegrations.lastError,
      updatedAt: schema.platformEmailIntegrations.updatedAt,
    })
    .from(schema.platformEmailIntegrations)
    .where(eq(schema.platformEmailIntegrations.id, SINGLETON_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertPlatformEmailIntegrationConfigRow(
  config: EmailIntegrationConfig,
): Promise<void> {
  await activeDb()
    .insert(schema.platformEmailIntegrations)
    .values({
      id: SINGLETON_ID,
      providerId: config.providerId,
      fromAddress: config.fromAddress,
      fromName: config.fromName,
      smtpUsername: config.smtpUsername,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      connected: config.connected,
      hasCredentials: config.hasCredentials,
      lastTestAt: config.lastTestAt ? new Date(config.lastTestAt) : null,
      lastTestOk: config.lastTestOk ?? null,
      lastError: config.lastError,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.platformEmailIntegrations.id,
      set: {
        providerId: config.providerId,
        fromAddress: config.fromAddress,
        fromName: config.fromName,
        smtpUsername: config.smtpUsername,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        connected: config.connected,
        hasCredentials: config.hasCredentials,
        lastTestAt: config.lastTestAt ? new Date(config.lastTestAt) : null,
        lastTestOk: config.lastTestOk ?? null,
        lastError: config.lastError,
        updatedAt: new Date(),
      },
    });
}

export async function upsertPlatformEmailIntegrationSecretsRow(
  secrets: EmailIntegrationSecrets,
): Promise<void> {
  await activeDb()
    .insert(schema.platformEmailIntegrations)
    .values({
      id: SINGLETON_ID,
      providerId: DEFAULT_EMAIL_INTEGRATION.providerId,
      smtpPassword: secrets.smtpPassword,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.platformEmailIntegrations.id,
      set: {
        smtpPassword: secrets.smtpPassword,
        updatedAt: new Date(),
      },
    });
}
