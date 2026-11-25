import {
  mergeWhatsappIntegrationConfig,
  type WhatsappIntegrationConfig,
  type WhatsappIntegrationSecrets,
  type WhatsappProviderId,
} from "@mms/contracts";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createIntegrationConfigService } from "../../lib/createIntegrationConfigService.js";
import { messagingRepository } from "../../messaging/repository/messagingRepositoryAdapter.js";
import { type WhatsappIntegrationRow } from "@mms/db/schema/messaging";

function rowToConfig(row: WhatsappIntegrationRow): WhatsappIntegrationConfig {
  const overrides: Partial<WhatsappIntegrationConfig> = {
    providerId: row.providerId as WhatsappProviderId,
    accountId: row.accountId,
    senderId: row.senderId,
    connected: row.connected,
    hasCredentials: row.hasCredentials,
  };

  if (row.phoneNumberId) overrides.phoneNumberId = row.phoneNumberId;
  if (row.apiBaseUrl) overrides.apiBaseUrl = row.apiBaseUrl;
  if (row.lastTestAt) overrides.lastTestAt = row.lastTestAt.toISOString();
  if (row.lastTestOk != null) overrides.lastTestOk = row.lastTestOk;
  if (row.lastError) overrides.lastError = row.lastError;

  return mergeWhatsappIntegrationConfig(overrides);
}

const service = createIntegrationConfigService<
  WhatsappIntegrationConfig,
  WhatsappIntegrationSecrets,
  WhatsappIntegrationRow
>({
  rowToConfig,
  emptyConfig: () => mergeWhatsappIntegrationConfig(null),
  mergeConfig: (config) => mergeWhatsappIntegrationConfig(config),
  loadRow: () => {
    const subdomain = getRequestTenant();
    if (!subdomain) return Promise.resolve(null);
    return messagingRepository.getWhatsappIntegrationRow(subdomain);
  },
  upsertConfig: (config) => {
    const subdomain = getRequestTenant();
    if (!subdomain) throw new Error("Tenant context missing");
    return messagingRepository.upsertWhatsappIntegrationConfigRow(subdomain, config);
  },
  upsertSecrets: (secrets) => {
    const subdomain = getRequestTenant();
    if (!subdomain) throw new Error("Tenant context missing");
    return messagingRepository.upsertWhatsappIntegrationSecretsRow(subdomain, secrets);
  },
  secretsFromRow: (row) => {
    const secrets: WhatsappIntegrationSecrets = {};
    if (row.accountSecret) secrets.accountSecret = row.accountSecret;
    return secrets;
  },
  tenantScoped: true,
});

export const loadWhatsappIntegrationConfig = service.loadConfig;
export const saveWhatsappIntegrationConfig = service.saveConfig;
export const loadWhatsappIntegrationSecrets = service.loadSecrets;
export const saveWhatsappIntegrationSecrets = service.saveSecrets;
export const markWhatsappIntegrationTestResult = service.markTestResult;
