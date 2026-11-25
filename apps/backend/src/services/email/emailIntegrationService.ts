import {
  mergeEmailIntegrationConfig,
  type EmailIntegrationConfig,
  type EmailIntegrationSecrets,
  type EmailProviderId,
} from "@mms/contracts";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createIntegrationConfigService } from "../../lib/createIntegrationConfigService.js";
import {
  getEmailIntegrationRow,
  upsertEmailIntegrationConfigRow,
  upsertEmailIntegrationSecretsRow,
} from "../../db/repositories/emailIntegrationRepository.js";
import { type EmailIntegrationRow } from "@mms/db/schema/messaging";

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

const service = createIntegrationConfigService<
  EmailIntegrationConfig,
  EmailIntegrationSecrets,
  EmailIntegrationRow
>({
  rowToConfig,
  emptyConfig: () => mergeEmailIntegrationConfig(null),
  mergeConfig: (config) => mergeEmailIntegrationConfig(config),
  loadRow: () => {
    const subdomain = getRequestTenant();
    if (!subdomain) return Promise.resolve(null);
    return getEmailIntegrationRow(subdomain);
  },
  upsertConfig: (config) => {
    const subdomain = getRequestTenant();
    if (!subdomain) throw new Error("Tenant context missing");
    return upsertEmailIntegrationConfigRow(subdomain, config);
  },
  upsertSecrets: (secrets) => {
    const subdomain = getRequestTenant();
    if (!subdomain) throw new Error("Tenant context missing");
    return upsertEmailIntegrationSecretsRow(subdomain, secrets);
  },
  secretsFromRow: (row) => {
    const secrets: EmailIntegrationSecrets = {};
    if (row.smtpPassword) secrets.smtpPassword = row.smtpPassword;
    return secrets;
  },
  tenantScoped: true,
});

export const loadEmailIntegrationConfig = service.loadConfig;
export const saveEmailIntegrationConfig = service.saveConfig;
export const loadEmailIntegrationSecrets = service.loadSecrets;
export const saveEmailIntegrationSecrets = service.saveSecrets;
export const markEmailIntegrationTestResult = service.markTestResult;
