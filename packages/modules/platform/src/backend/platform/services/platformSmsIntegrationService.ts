import {
  mergeSmsIntegrationConfig,
  type SmsIntegrationConfig,
  type SmsIntegrationSecrets,
  type SmsProviderId,
} from "@mms/contracts";
import { createIntegrationConfigService } from "../deps.js";
import {
  getPlatformSmsIntegrationRow,
  upsertPlatformSmsIntegrationConfigRow,
  upsertPlatformSmsIntegrationSecretsRow,
} from "../repository/db/platformSmsIntegrationRepository.js";
import { type PlatformSmsIntegrationRow } from "@mms/db/schema/platform";

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

let serviceInstance: ReturnType<typeof createIntegrationConfigService> | null = null;
function serviceRuntime() {
  return (serviceInstance ??= createIntegrationConfigService<
    SmsIntegrationConfig,
    SmsIntegrationSecrets,
    PlatformSmsIntegrationRow
  >({
    rowToConfig,
    emptyConfig: () => mergeSmsIntegrationConfig(null),
    mergeConfig: (config: any) => mergeSmsIntegrationConfig(config),
    loadRow: () => getPlatformSmsIntegrationRow(),
    upsertConfig: (config: any) => upsertPlatformSmsIntegrationConfigRow(config),
    upsertSecrets: (secrets: any) => upsertPlatformSmsIntegrationSecretsRow(secrets),
    secretsFromRow: (row: any) => {
      const secrets: SmsIntegrationSecrets = {};
      if (row.accountSecret) secrets.accountSecret = row.accountSecret;
      return secrets;
    },
    tenantScoped: false,
  }));
}

export function loadPlatformSmsIntegrationConfig(...args: any[]): any {
  return serviceRuntime().loadConfig(...args);
}
export function savePlatformSmsIntegrationConfig(...args: any[]): any {
  return serviceRuntime().saveConfig(...args);
}
export function loadPlatformSmsIntegrationSecrets(...args: any[]): any {
  return serviceRuntime().loadSecrets(...args);
}
export function savePlatformSmsIntegrationSecrets(...args: any[]): any {
  return serviceRuntime().saveSecrets(...args);
}
export function markPlatformSmsIntegrationTestResult(...args: any[]): any {
  return serviceRuntime().markTestResult(...args);
}
