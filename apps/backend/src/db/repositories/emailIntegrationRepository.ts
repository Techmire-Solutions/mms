import { eq } from "drizzle-orm";
import { withTenant } from "../tenant-context.js";
import * as schema from "../schema.js";
import { type EmailIntegrationRow } from "../schema/messaging.js";
import type { EmailIntegrationConfig, EmailIntegrationSecrets } from "@mms/shared";
import { DEFAULT_EMAIL_INTEGRATION } from "@mms/shared";

export async function getEmailIntegrationRow(
  workspaceSubdomain: string,
): Promise<EmailIntegrationRow | null> {
  try {
    return await withTenant(workspaceSubdomain, async (tx) => {
      if (!tx || typeof tx.select !== "function") return null;
      const rows = await tx
        .select({
          workspaceSubdomain: schema.emailIntegrations.workspaceSubdomain,
          providerId: schema.emailIntegrations.providerId,
          fromAddress: schema.emailIntegrations.fromAddress,
          fromName: schema.emailIntegrations.fromName,
          smtpUsername: schema.emailIntegrations.smtpUsername,
          smtpHost: schema.emailIntegrations.smtpHost,
          smtpPort: schema.emailIntegrations.smtpPort,
          smtpSecure: schema.emailIntegrations.smtpSecure,
          smtpPassword: schema.emailIntegrations.smtpPassword,
          connected: schema.emailIntegrations.connected,
          hasCredentials: schema.emailIntegrations.hasCredentials,
          lastTestAt: schema.emailIntegrations.lastTestAt,
          lastTestOk: schema.emailIntegrations.lastTestOk,
          lastError: schema.emailIntegrations.lastError,
          updatedAt: schema.emailIntegrations.updatedAt,
        })
        .from(schema.emailIntegrations)
        .where(eq(schema.emailIntegrations.workspaceSubdomain, workspaceSubdomain))
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

export async function upsertEmailIntegrationConfigRow(
  workspaceSubdomain: string,
  config: EmailIntegrationConfig,
): Promise<void> {
  await withTenant(workspaceSubdomain, async (tx) => {
    if (!tx || typeof tx.insert !== "function") return;
    await tx
      .insert(schema.emailIntegrations)
      .values({
        workspaceSubdomain,
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
        target: schema.emailIntegrations.workspaceSubdomain,
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
  });
}

export async function upsertEmailIntegrationSecretsRow(
  workspaceSubdomain: string,
  secrets: EmailIntegrationSecrets,
): Promise<void> {
  await withTenant(workspaceSubdomain, async (tx) => {
    if (!tx || typeof tx.insert !== "function") return;
    await tx
      .insert(schema.emailIntegrations)
      .values({
        workspaceSubdomain,
        providerId: DEFAULT_EMAIL_INTEGRATION.providerId,
        smtpPassword: secrets.smtpPassword,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.emailIntegrations.workspaceSubdomain,
        set: {
          smtpPassword: secrets.smtpPassword,
          updatedAt: new Date(),
        },
      });
  });
}
