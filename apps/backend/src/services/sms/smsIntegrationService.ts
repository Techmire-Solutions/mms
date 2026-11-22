import {
  mergeSmsIntegrationConfig,
  type SmsIntegrationConfig,
  type SmsIntegrationSecrets,
  type SmsProviderId,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createIntegrationConfigService } from "../../lib/createIntegrationConfigService.js";
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

const service = createIntegrationConfigService<
  SmsIntegrationConfig,
  SmsIntegrationSecrets,
  SmsIntegrationRow
>({
  rowToConfig,
  emptyConfig: () => mergeSmsIntegrationConfig(null),
  mergeConfig: (config) => mergeSmsIntegrationConfig(config),
  loadRow: () => {
    const subdomain = getRequestTenant();
    if (!subdomain) return Promise.resolve(null);
    return getSmsIntegrationRow(subdomain);
  },
  upsertConfig: (config) => {
    const subdomain = getRequestTenant();
    if (!subdomain) throw new Error("Tenant context missing");
    return upsertSmsIntegrationConfigRow(subdomain, config);
  },
  upsertSecrets: (secrets) => {
    const subdomain = getRequestTenant();
    if (!subdomain) throw new Error("Tenant context missing");
    return upsertSmsIntegrationSecretsRow(subdomain, secrets);
  },
  secretsFromRow: (row) => {
    const secrets: SmsIntegrationSecrets = {};
    if (row.accountSecret) secrets.accountSecret = row.accountSecret;
    return secrets;
  },
  tenantScoped: true,
});

export const loadSmsIntegrationConfig = service.loadConfig;
export const saveSmsIntegrationConfig = service.saveConfig;
export const loadSmsIntegrationSecrets = service.loadSecrets;
export const saveSmsIntegrationSecrets = service.saveSecrets;
export const markSmsIntegrationTestResult = service.markTestResult;
