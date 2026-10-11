import {
  mergeSmsIntegrationConfig,
  type SmsIntegrationConfig,
  type SmsIntegrationSecrets,
  type SmsProviderId,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import {
  getSmsIntegrationRow,
  upsertSmsIntegrationConfigRow,
  upsertSmsIntegrationSecretsRow,
} from "../../db/repositories/smsIntegrationRepository.js";
import { type SmsIntegrationRow } from "../../db/schema/messaging.js";

function rowToConfig(row: SmsIntegrationRow): SmsIntegrationConfig {
  const overrides: Partial<SmsIntegrationConfig> = {
    // (typed as SmsProviderId because the column is varchar; mergeSmsIntegrationConfig
    //  re-validates via isSmsProviderId and falls back to the default)
    providerId: row.providerId as SmsProviderId,
    accountId: row.accountId,
    senderId: row.senderId,
    connected: row.connected,
    hasCredentials: row.hasCredentials,
  };

  if (row.apiBaseUrl) overrides.apiBaseUrl = row.apiBaseUrl;
  if (row.lastTestAt) overrides.lastTestAt = row.lastTestAt.toISOString();
  if (row.lastTestOk != null) overrides.lastTestOk = row.lastTestOk;
  if (row.lastError) overrides.lastError = row.lastError;

  return mergeSmsIntegrationConfig(overrides);
}

export async function loadSmsIntegrationConfig(): Promise<SmsIntegrationConfig> {
  const subdomain = getRequestTenant();
  if (!subdomain) return mergeSmsIntegrationConfig(null);
  const row = await getSmsIntegrationRow(subdomain);
  if (!row) return mergeSmsIntegrationConfig(null);

  return rowToConfig(row);
}

export async function saveSmsIntegrationConfig(
  config: SmsIntegrationConfig,
): Promise<SmsIntegrationConfig> {
  const subdomain = getRequestTenant();
  if (!subdomain) throw new Error("Tenant context missing");
  const merged = mergeSmsIntegrationConfig(config);
  await upsertSmsIntegrationConfigRow(subdomain, merged);
  return merged;
}

export async function loadSmsIntegrationSecrets(): Promise<SmsIntegrationSecrets> {
  const subdomain = getRequestTenant();
  if (!subdomain) return {};
  const row = await getSmsIntegrationRow(subdomain);
  if (!row) return {};

  const secrets: SmsIntegrationSecrets = {};
  if (row.accountSecret) secrets.accountSecret = row.accountSecret;
  return secrets;
}

export async function saveSmsIntegrationSecrets(secrets: SmsIntegrationSecrets): Promise<void> {
  const subdomain = getRequestTenant();
  if (!subdomain) throw new Error("Tenant context missing");
  await upsertSmsIntegrationSecretsRow(subdomain, secrets);
}

export async function markSmsIntegrationTestResult(
  ok: boolean,
  errorMessage?: string,
): Promise<SmsIntegrationConfig> {
  const current = await loadSmsIntegrationConfig();
  const updated = mergeSmsIntegrationConfig({
    ...current,
    connected: ok,
    hasCredentials: current.hasCredentials,
    lastTestAt: new Date().toISOString(),
    lastTestOk: ok,
    lastError: ok ? undefined : errorMessage,
  });
  return saveSmsIntegrationConfig(updated);
}
