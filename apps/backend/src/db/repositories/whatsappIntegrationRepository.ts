import { eq } from "drizzle-orm";
import { withTenant } from "../tenant-context.js";
import * as schema from "../schema.js";
import { type WhatsappIntegrationRow } from "../schema/messaging.js";
import type { WhatsappIntegrationConfig, WhatsappIntegrationSecrets } from "@mms/shared";
import { DEFAULT_WHATSAPP_INTEGRATION } from "@mms/shared";

export async function getWhatsappIntegrationRow(
  workspaceSubdomain: string,
): Promise<WhatsappIntegrationRow | null> {
  try {
    return await withTenant(workspaceSubdomain, async (tx) => {
      if (!tx || typeof tx.select !== "function") return null;
      const rows = await tx
        .select({
          workspaceSubdomain: schema.whatsappIntegrations.workspaceSubdomain,
          providerId: schema.whatsappIntegrations.providerId,
          accountId: schema.whatsappIntegrations.accountId,
          phoneNumberId: schema.whatsappIntegrations.phoneNumberId,
          senderId: schema.whatsappIntegrations.senderId,
          apiBaseUrl: schema.whatsappIntegrations.apiBaseUrl,
          accountSecret: schema.whatsappIntegrations.accountSecret,
          connected: schema.whatsappIntegrations.connected,
          hasCredentials: schema.whatsappIntegrations.hasCredentials,
          lastTestAt: schema.whatsappIntegrations.lastTestAt,
          lastTestOk: schema.whatsappIntegrations.lastTestOk,
          lastError: schema.whatsappIntegrations.lastError,
          updatedAt: schema.whatsappIntegrations.updatedAt,
        })
        .from(schema.whatsappIntegrations)
        .where(eq(schema.whatsappIntegrations.workspaceSubdomain, workspaceSubdomain))
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

export async function upsertWhatsappIntegrationConfigRow(
  workspaceSubdomain: string,
  config: WhatsappIntegrationConfig,
): Promise<void> {
  await withTenant(workspaceSubdomain, async (tx) => {
    if (!tx || typeof tx.insert !== "function") return;
    await tx
      .insert(schema.whatsappIntegrations)
      .values({
        workspaceSubdomain,
        providerId: config.providerId,
        accountId: config.accountId,
        phoneNumberId: config.phoneNumberId,
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
        target: schema.whatsappIntegrations.workspaceSubdomain,
        set: {
          providerId: config.providerId,
          accountId: config.accountId,
          phoneNumberId: config.phoneNumberId,
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

export async function upsertWhatsappIntegrationSecretsRow(
  workspaceSubdomain: string,
  secrets: WhatsappIntegrationSecrets,
): Promise<void> {
  await withTenant(workspaceSubdomain, async (tx) => {
    if (!tx || typeof tx.insert !== "function") return;
    await tx
      .insert(schema.whatsappIntegrations)
      .values({
        workspaceSubdomain,
        providerId: DEFAULT_WHATSAPP_INTEGRATION.providerId,
        accountSecret: secrets.accountSecret,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.whatsappIntegrations.workspaceSubdomain,
        set: {
          accountSecret: secrets.accountSecret,
          updatedAt: new Date(),
        },
      });
  });
}
