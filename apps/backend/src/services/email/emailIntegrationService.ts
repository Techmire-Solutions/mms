import {
  mergeEmailIntegrationConfig,
  type EmailIntegrationConfig,
  type EmailIntegrationSecrets,
  type EmailProviderId,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import {
  getEmailIntegrationRow,
  upsertEmailIntegrationConfigRow,
  upsertEmailIntegrationSecretsRow,
} from "../../db/repositories/emailIntegrationRepository.js";
import { type EmailIntegrationRow } from "../../db/schema/messaging.js";

function rowToConfig(row: EmailIntegrationRow): EmailIntegrationConfig {
  const overrides: Partial<EmailIntegrationConfig> = {
    // (typed as EmailProviderId because the column is varchar; mergeEmailIntegrationConfig
    //  re-validates via isEmailProviderId and falls back to the default)
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

export async function loadEmailIntegrationConfig(): Promise<EmailIntegrationConfig> {
  const subdomain = getRequestTenant();
  if (!subdomain) return mergeEmailIntegrationConfig(null);
  const row = await getEmailIntegrationRow(subdomain);
  if (!row) return mergeEmailIntegrationConfig(null);

  return rowToConfig(row);
}

export async function saveEmailIntegrationConfig(
  config: EmailIntegrationConfig,
): Promise<EmailIntegrationConfig> {
  const subdomain = getRequestTenant();
  if (!subdomain) throw new Error("Tenant context missing");
  const merged = mergeEmailIntegrationConfig(config);
  await upsertEmailIntegrationConfigRow(subdomain, merged);
  return merged;
}

export async function loadEmailIntegrationSecrets(): Promise<EmailIntegrationSecrets> {
  const subdomain = getRequestTenant();
  if (!subdomain) return {};
  const row = await getEmailIntegrationRow(subdomain);
  if (!row) return {};

  const secrets: EmailIntegrationSecrets = {};
  if (row.smtpPassword) secrets.smtpPassword = row.smtpPassword;
  return secrets;
}

export async function saveEmailIntegrationSecrets(secrets: EmailIntegrationSecrets): Promise<void> {
  const subdomain = getRequestTenant();
  if (!subdomain) throw new Error("Tenant context missing");
  await upsertEmailIntegrationSecretsRow(subdomain, secrets);
}

export async function markEmailIntegrationTestResult(
  ok: boolean,
  errorMessage?: string,
): Promise<EmailIntegrationConfig> {
  const current = await loadEmailIntegrationConfig();
  const updated = mergeEmailIntegrationConfig({
    ...current,
    connected: ok,
    hasCredentials: current.hasCredentials,
    lastTestAt: new Date().toISOString(),
    lastTestOk: ok,
    lastError: ok ? undefined : errorMessage,
  });
  return saveEmailIntegrationConfig(updated);
}
