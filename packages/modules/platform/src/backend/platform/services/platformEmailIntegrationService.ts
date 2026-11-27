import {
  mergeEmailIntegrationConfig,
  type EmailIntegrationConfig,
  type EmailIntegrationSecrets,
  type EmailProviderId,
} from "@mms/contracts";
import { createIntegrationConfigService } from "../deps.js";
import {
  getPlatformEmailIntegrationRow,
  upsertPlatformEmailIntegrationConfigRow,
  upsertPlatformEmailIntegrationSecretsRow,
} from "../repository/db/platformEmailIntegrationRepository.js";
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

let serviceInstance: ReturnType<typeof createIntegrationConfigService> | null = null;
function serviceRuntime() {
  return (serviceInstance ??= createIntegrationConfigService<
    EmailIntegrationConfig,
    EmailIntegrationSecrets,
    PlatformEmailIntegrationRow
  >({
    rowToConfig,
    emptyConfig: () => mergeEmailIntegrationConfig(null),
    mergeConfig: (config: any) => mergeEmailIntegrationConfig(config),
    loadRow: () => getPlatformEmailIntegrationRow(),
    upsertConfig: (config: any) => upsertPlatformEmailIntegrationConfigRow(config),
    upsertSecrets: (secrets: any) => upsertPlatformEmailIntegrationSecretsRow(secrets),
    secretsFromRow: (row: any) => {
      const secrets: EmailIntegrationSecrets = {};
      if (row.smtpPassword) secrets.smtpPassword = row.smtpPassword;
      return secrets;
    },
    tenantScoped: false,
  }));
}

export function loadPlatformEmailIntegrationConfig(...args: any[]): any {
  return serviceRuntime().loadConfig(...args);
}
export function savePlatformEmailIntegrationConfig(...args: any[]): any {
  return serviceRuntime().saveConfig(...args);
}
export function loadPlatformEmailIntegrationSecrets(...args: any[]): any {
  return serviceRuntime().loadSecrets(...args);
}
export function savePlatformEmailIntegrationSecrets(...args: any[]): any {
  return serviceRuntime().saveSecrets(...args);
}
export function markPlatformEmailIntegrationTestResult(...args: any[]): any {
  return serviceRuntime().markTestResult(...args);
}
