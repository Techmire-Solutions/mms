import {
  mergeEmailIntegrationConfig,
  type EmailIntegrationConfig,
  type EmailIntegrationSecrets,
  type EmailProviderId,
} from "@mms/shared";
import {
  getPlatformEmailIntegrationRow,
  upsertPlatformEmailIntegrationConfigRow,
  upsertPlatformEmailIntegrationSecretsRow,
} from "../../db/repositories/platformEmailIntegrationRepository.js";
import { type PlatformEmailIntegrationRow } from "../../db/schema/platform.js";

function rowToConfig(row: PlatformEmailIntegrationRow): EmailIntegrationConfig {
  const overrides: Partial<EmailIntegrationConfig> = {
    providerId: row.providerId as EmailProviderId,
    fromAddress: row.fromAddress,
    fromName: row.fromName,
    smtpUsername: row.smtpUsername,
    connected: row.connected,
    hasCredentials: row.hasCredentials,
  };

  if (row.smtpHost) overrides.smtpHost = row.smtpHost;
  if (row.smtpPort != null) overrides.smtpPort = row.smtpPort;
  if (row.smtpSecure != null) overrides.smtpSecure = row.smtpSecure;
  if (row.lastTestAt) overrides.lastTestAt = row.lastTestAt.toISOString();
  if (row.lastTestOk != null) overrides.lastTestOk = row.lastTestOk;
  if (row.lastError) overrides.lastError = row.lastError;

  return mergeEmailIntegrationConfig(overrides);
}

export async function loadPlatformEmailIntegrationConfig(): Promise<EmailIntegrationConfig> {
  const row = await getPlatformEmailIntegrationRow();
  if (!row) return mergeEmailIntegrationConfig(null);
  return rowToConfig(row);
}

export async function savePlatformEmailIntegrationConfig(
  config: EmailIntegrationConfig,
): Promise<EmailIntegrationConfig> {
  const merged = mergeEmailIntegrationConfig(config);
  await upsertPlatformEmailIntegrationConfigRow(merged);
  return merged;
}

export async function loadPlatformEmailIntegrationSecrets(): Promise<EmailIntegrationSecrets> {
  const row = await getPlatformEmailIntegrationRow();
  if (!row) return {};
  const secrets: EmailIntegrationSecrets = {};
  if (row.smtpPassword) secrets.smtpPassword = row.smtpPassword;
  return secrets;
}

export async function savePlatformEmailIntegrationSecrets(
  secrets: EmailIntegrationSecrets,
): Promise<void> {
  await upsertPlatformEmailIntegrationSecretsRow(secrets);
}

export async function markPlatformEmailIntegrationTestResult(
  ok: boolean,
  errorMessage?: string,
): Promise<EmailIntegrationConfig> {
  const current = await loadPlatformEmailIntegrationConfig();
  const updated = mergeEmailIntegrationConfig({
    ...current,
    connected: ok,
    hasCredentials: current.hasCredentials,
    lastTestAt: new Date().toISOString(),
    lastTestOk: ok,
    lastError: ok ? undefined : errorMessage,
  });
  return savePlatformEmailIntegrationConfig(updated);
}
