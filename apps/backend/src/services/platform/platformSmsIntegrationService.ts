import {
  mergeSmsIntegrationConfig,
  type SmsIntegrationConfig,
  type SmsIntegrationSecrets,
  type SmsProviderId,
} from "@mms/contracts";
import { createIntegrationConfigService } from "../../lib/createIntegrationConfigService.js";
import {
  getPlatformSmsIntegrationRow,
  upsertPlatformSmsIntegrationConfigRow,
  upsertPlatformSmsIntegrationSecretsRow,
} from "../../db/repositories/platformSmsIntegrationRepository.js";
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

const service = createIntegrationConfigService<
  SmsIntegrationConfig,
  SmsIntegrationSecrets,
  PlatformSmsIntegrationRow
>({
  rowToConfig,
  emptyConfig: () => mergeSmsIntegrationConfig(null),
  mergeConfig: (config) => mergeSmsIntegrationConfig(config),
  loadRow: () => getPlatformSmsIntegrationRow(),
  upsertConfig: (config) => upsertPlatformSmsIntegrationConfigRow(config),
  upsertSecrets: (secrets) => upsertPlatformSmsIntegrationSecretsRow(secrets),
  secretsFromRow: (row) => {
    const secrets: SmsIntegrationSecrets = {};
    if (row.accountSecret) secrets.accountSecret = row.accountSecret;
    return secrets;
  },
  tenantScoped: false,
});

export const loadPlatformSmsIntegrationConfig = service.loadConfig;
export const savePlatformSmsIntegrationConfig = service.saveConfig;
export const loadPlatformSmsIntegrationSecrets = service.loadSecrets;
export const savePlatformSmsIntegrationSecrets = service.saveSecrets;
export const markPlatformSmsIntegrationTestResult = service.markTestResult;
