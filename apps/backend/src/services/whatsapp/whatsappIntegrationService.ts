import {
  mergeWhatsappIntegrationConfig,
  type WhatsappIntegrationConfig,
  type WhatsappIntegrationSecrets,
  type WhatsappProviderId,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { messagingRepository } from "../../messaging/repository/messagingRepositoryAdapter.js";
import { type WhatsappIntegrationRow } from "../../db/schema/messaging.js";

function rowToConfig(row: WhatsappIntegrationRow): WhatsappIntegrationConfig {
  const overrides: Partial<WhatsappIntegrationConfig> = {
    providerId: row.providerId as WhatsappProviderId,
    accountId: row.accountId,
    senderId: row.senderId,
    connected: row.connected,
    hasCredentials: row.hasCredentials,
  };

  if (row.phoneNumberId) overrides.phoneNumberId = row.phoneNumberId;
  if (row.apiBaseUrl) overrides.apiBaseUrl = row.apiBaseUrl;
  if (row.lastTestAt) overrides.lastTestAt = row.lastTestAt.toISOString();
  if (row.lastTestOk != null) overrides.lastTestOk = row.lastTestOk;
  if (row.lastError) overrides.lastError = row.lastError;

  return mergeWhatsappIntegrationConfig(overrides);
}

export async function loadWhatsappIntegrationConfig(): Promise<WhatsappIntegrationConfig> {
  const subdomain = getRequestTenant();
  if (!subdomain) return mergeWhatsappIntegrationConfig(null);
  const row = await messagingRepository.getWhatsappIntegrationRow(subdomain);
  if (!row) return mergeWhatsappIntegrationConfig(null);

  return rowToConfig(row);
}

export async function saveWhatsappIntegrationConfig(
  config: WhatsappIntegrationConfig,
): Promise<WhatsappIntegrationConfig> {
  const subdomain = getRequestTenant();
  if (!subdomain) throw new Error("Tenant context missing");
  const merged = mergeWhatsappIntegrationConfig(config);
  await messagingRepository.upsertWhatsappIntegrationConfigRow(subdomain, merged);
  return merged;
}

export async function loadWhatsappIntegrationSecrets(): Promise<WhatsappIntegrationSecrets> {
  const subdomain = getRequestTenant();
  if (!subdomain) return {};
  const row = await messagingRepository.getWhatsappIntegrationRow(subdomain);
  if (!row) return {};

  const secrets: WhatsappIntegrationSecrets = {};
  if (row.accountSecret) secrets.accountSecret = row.accountSecret;
  return secrets;
}

export async function saveWhatsappIntegrationSecrets(
  secrets: WhatsappIntegrationSecrets,
): Promise<void> {
  const subdomain = getRequestTenant();
  if (!subdomain) throw new Error("Tenant context missing");
  await messagingRepository.upsertWhatsappIntegrationSecretsRow(subdomain, secrets);
}

export async function markWhatsappIntegrationTestResult(
  ok: boolean,
  errorMessage?: string,
): Promise<WhatsappIntegrationConfig> {
  const current = await loadWhatsappIntegrationConfig();
  const updated = mergeWhatsappIntegrationConfig({
    ...current,
    connected: ok,
    hasCredentials: current.hasCredentials,
    lastTestAt: new Date().toISOString(),
    lastTestOk: ok,
    lastError: ok ? undefined : errorMessage,
  });
  return saveWhatsappIntegrationConfig(updated);
}
