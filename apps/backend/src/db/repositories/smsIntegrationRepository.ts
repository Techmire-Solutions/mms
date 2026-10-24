import { eq } from "drizzle-orm";
import { withTenant } from "../tenant-context.js";
import * as schema from "../schema.js";
import { type SmsIntegrationRow } from "../schema/messaging.js";
import type { SmsIntegrationConfig, SmsIntegrationSecrets } from "@mms/shared";
import { DEFAULT_SMS_INTEGRATION } from "@mms/shared";

export async function getSmsIntegrationRow(
  workspaceSubdomain: string,
): Promise<SmsIntegrationRow | null> {
  try {
    return await withTenant(workspaceSubdomain, async (tx) => {
      if (!tx || typeof tx.select !== "function") return null;
      const rows = await tx
        .select({
          workspaceSubdomain: schema.smsIntegrations.workspaceSubdomain,
          providerId: schema.smsIntegrations.providerId,
          accountId: schema.smsIntegrations.accountId,
          senderId: schema.smsIntegrations.senderId,
          apiBaseUrl: schema.smsIntegrations.apiBaseUrl,
          accountSecret: schema.smsIntegrations.accountSecret,
          connected: schema.smsIntegrations.connected,
          hasCredentials: schema.smsIntegrations.hasCredentials,
          lastTestAt: schema.smsIntegrations.lastTestAt,
          lastTestOk: schema.smsIntegrations.lastTestOk,
          lastError: schema.smsIntegrations.lastError,
          updatedAt: schema.smsIntegrations.updatedAt,
        })
        .from(schema.smsIntegrations)
        .where(eq(schema.smsIntegrations.workspaceSubdomain, workspaceSubdomain))
        .limit(1);
      return rows[0] ?? null;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Database not initialized") {
      return null;
    }
    throw err;
  }
}

export async function upsertSmsIntegrationConfigRow(
  workspaceSubdomain: string,
  config: SmsIntegrationConfig,
): Promise<void> {
  await withTenant(workspaceSubdomain, async (tx) => {
    if (!tx || typeof tx.insert !== "function") return;
    await tx
      .insert(schema.smsIntegrations)
      .values({
        workspaceSubdomain,
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
        target: schema.smsIntegrations.workspaceSubdomain,
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
  });
}

export async function upsertSmsIntegrationSecretsRow(
  workspaceSubdomain: string,
  secrets: SmsIntegrationSecrets,
): Promise<void> {
  await withTenant(workspaceSubdomain, async (tx) => {
    if (!tx || typeof tx.insert !== "function") return;
    await tx
      .insert(schema.smsIntegrations)
      .values({
        workspaceSubdomain,
        providerId: DEFAULT_SMS_INTEGRATION.providerId,
        accountSecret: secrets.accountSecret,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.smsIntegrations.workspaceSubdomain,
        set: {
          accountSecret: secrets.accountSecret,
          updatedAt: new Date(),
        },
      });
  });
}
