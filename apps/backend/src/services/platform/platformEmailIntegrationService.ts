import {
  mergeEmailIntegrationConfig,
  type EmailIntegrationConfig,
  type EmailIntegrationSecrets,
  type EmailProviderId,
} from "@mms/contracts";
import { createIntegrationConfigService } from "../../lib/createIntegrationConfigService.js";
import {
  getPlatformEmailIntegrationRow,
  upsertPlatformEmailIntegrationConfigRow,
  upsertPlatformEmailIntegrationSecretsRow,
} from "../../db/repositories/platformEmailIntegrationRepository.js";
import { type PlatformEmailIntegrationRow } from "@mms/db/schema/platform";

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

const service = createIntegrationConfigService<
  EmailIntegrationConfig,
  EmailIntegrationSecrets,
  PlatformEmailIntegrationRow
>({
  rowToConfig,
  emptyConfig: () => mergeEmailIntegrationConfig(null),
  mergeConfig: (config) => mergeEmailIntegrationConfig(config),
  loadRow: () => getPlatformEmailIntegrationRow(),
  upsertConfig: (config) => upsertPlatformEmailIntegrationConfigRow(config),
  upsertSecrets: (secrets) => upsertPlatformEmailIntegrationSecretsRow(secrets),
  secretsFromRow: (row) => {
    const secrets: EmailIntegrationSecrets = {};
    if (row.smtpPassword) secrets.smtpPassword = row.smtpPassword;
    return secrets;
  },
  tenantScoped: false,
});

export const loadPlatformEmailIntegrationConfig = service.loadConfig;
export const savePlatformEmailIntegrationConfig = service.saveConfig;
export const loadPlatformEmailIntegrationSecrets = service.loadSecrets;
export const savePlatformEmailIntegrationSecrets = service.saveSecrets;
export const markPlatformEmailIntegrationTestResult = service.markTestResult;
