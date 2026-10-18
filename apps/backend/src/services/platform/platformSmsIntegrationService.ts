import {
  mergeSmsIntegrationConfig,
  type SmsIntegrationConfig,
  type SmsIntegrationSecrets,
  type SmsProviderId,
} from "@mms/shared";
import {
  getPlatformSmsIntegrationRow,
  upsertPlatformSmsIntegrationConfigRow,
  upsertPlatformSmsIntegrationSecretsRow,
} from "../../db/repositories/platformSmsIntegrationRepository.js";
import { type PlatformSmsIntegrationRow } from "../../db/schema/platform.js";

function rowToConfig(row: PlatformSmsIntegrationRow): SmsIntegrationConfig {
  const overrides: Partial<SmsIntegrationConfig> = {
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

export async function loadPlatformSmsIntegrationConfig(): Promise<SmsIntegrationConfig> {
  const row = await getPlatformSmsIntegrationRow();
  if (!row) return mergeSmsIntegrationConfig(null);
  return rowToConfig(row);
}

export async function savePlatformSmsIntegrationConfig(
  config: SmsIntegrationConfig,
): Promise<SmsIntegrationConfig> {
  const merged = mergeSmsIntegrationConfig(config);
  await upsertPlatformSmsIntegrationConfigRow(merged);
  return merged;
}

export async function loadPlatformSmsIntegrationSecrets(): Promise<SmsIntegrationSecrets> {
  const row = await getPlatformSmsIntegrationRow();
  if (!row) return {};
  const secrets: SmsIntegrationSecrets = {};
  if (row.accountSecret) secrets.accountSecret = row.accountSecret;
  return secrets;
}

export async function savePlatformSmsIntegrationSecrets(
  secrets: SmsIntegrationSecrets,
): Promise<void> {
  await upsertPlatformSmsIntegrationSecretsRow(secrets);
}

export async function markPlatformSmsIntegrationTestResult(
  ok: boolean,
  errorMessage?: string,
): Promise<SmsIntegrationConfig> {
  const current = await loadPlatformSmsIntegrationConfig();
  const updated = mergeSmsIntegrationConfig({
    ...current,
    connected: ok,
    hasCredentials: current.hasCredentials,
    lastTestAt: new Date().toISOString(),
    lastTestOk: ok,
    lastError: ok ? undefined : errorMessage,
  });
  return savePlatformSmsIntegrationConfig(updated);
}
