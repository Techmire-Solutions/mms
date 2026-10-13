import type { AppTranslationKey } from "../i18n/appTranslations.js";

/** Logical object keys for SMS integration storage. */
export const SMS_INTEGRATION_OBJECT_KEY = "sms_integration" as const;

/** Backend-only — never synced to the browser. */
export const SMS_INTEGRATION_SECRETS_KEY = "sms_integration_secrets" as const;

const SMS_PROVIDERS = ["twilio", "vonage", "msg91", "infobip", "telesign", "logiqueues"] as const;

export type SmsProviderId = (typeof SMS_PROVIDERS)[number];

const SMS_PROVIDERS_SET = new Set<string>(SMS_PROVIDERS);

export function isSmsProviderId(value: unknown): value is SmsProviderId {
  return typeof value === "string" && SMS_PROVIDERS_SET.has(value);
}

export interface SmsProviderPreset {
  id: SmsProviderId;
  labelKey: AppTranslationKey;
  hintKey: AppTranslationKey;
  /** Only Infobip and Logiqueues take a per-account/self-host base URL; all others hardcode it. */
  requiresBaseUrl: boolean;
  /** Shown as the API Base URL field's placeholder when `requiresBaseUrl` is true. */
  baseUrlPlaceholder?: string;
}

/** Public integration config (safe to store in tenant sync). */
export interface SmsIntegrationConfig {
  providerId: SmsProviderId;
  /** Account SID (Twilio) / API Key (Vonage) / Customer ID (Telesign) — unused by MSG91/Infobip/Logiqueues. */
  accountId: string;
  /** Sender ID / From number, meaning varies per provider — unused by Logiqueues (tied to the paired phone's SIM). */
  senderId: string;
  /** Per-account API base URL — meaningful for Infobip and optionally Logiqueues (self-hosted override). */
  apiBaseUrl?: string;
  connected: boolean;
  hasCredentials: boolean;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastError?: string;
}

/** Credentials — server-side only. Holds Auth Token / API Secret / Auth Key / API Key depending on provider. */
export interface SmsIntegrationSecrets {
  accountSecret?: string;
}

export const DEFAULT_SMS_INTEGRATION: SmsIntegrationConfig = {
  providerId: "twilio",
  accountId: "",
  senderId: "",
  connected: false,
  hasCredentials: false,
};

export function mergeSmsIntegrationConfig(
  partial?: Partial<SmsIntegrationConfig> | null,
): SmsIntegrationConfig {
  const providerId = partial?.providerId ?? DEFAULT_SMS_INTEGRATION.providerId;
  return {
    ...DEFAULT_SMS_INTEGRATION,
    ...partial,
    providerId: isSmsProviderId(providerId) ? providerId : DEFAULT_SMS_INTEGRATION.providerId,
    accountId: partial?.accountId?.trim() ?? "",
    senderId: partial?.senderId?.trim() ?? "",
  };
}
