import type { AppTranslationKey } from "../i18n/appTranslations.js";

/** Logical object keys for WhatsApp integration storage. */
export const WHATSAPP_INTEGRATION_OBJECT_KEY = "whatsapp_integration" as const;

/** Backend-only — never synced to the browser. */
export const WHATSAPP_INTEGRATION_SECRETS_KEY = "whatsapp_integration_secrets" as const;

const WHATSAPP_PROVIDERS = ["meta", "twilio", "infobip"] as const;

export type WhatsappProviderId = (typeof WHATSAPP_PROVIDERS)[number];

const WHATSAPP_PROVIDERS_SET = new Set<string>(WHATSAPP_PROVIDERS);

export function isWhatsappProviderId(value: unknown): value is WhatsappProviderId {
  return typeof value === "string" && WHATSAPP_PROVIDERS_SET.has(value);
}

export interface WhatsappProviderPreset {
  id: WhatsappProviderId;
  labelKey: AppTranslationKey;
  hintKey: AppTranslationKey;
  requiresBaseUrl: boolean;
  requiresPhoneNumberId: boolean;
  baseUrlPlaceholder?: string;
  senderPlaceholder: string;
}

/** Public integration config (safe to store in tenant sync). */
export interface WhatsappIntegrationConfig {
  providerId: WhatsappProviderId;
  /** Meta WhatsApp Business Account ID / Twilio Account SID / Infobip account */
  accountId: string;
  /** Meta Phone Number ID (required for Meta Graph API) */
  phoneNumberId?: string;
  /** Sender ID / From number (e.g. +14155238886 or approved sender name) */
  senderId: string;
  /** Custom API base URL (required for Infobip) */
  apiBaseUrl?: string;
  connected: boolean;
  hasCredentials: boolean;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastError?: string;
}

/** Credentials — server-side only. Meta Access Token / Twilio Auth Token / Infobip API Key. */
export interface WhatsappIntegrationSecrets {
  accountSecret?: string;
}

export const DEFAULT_WHATSAPP_INTEGRATION: WhatsappIntegrationConfig = {
  providerId: "meta",
  accountId: "",
  senderId: "",
  connected: false,
  hasCredentials: false,
};

export function mergeWhatsappIntegrationConfig(
  partial?: Partial<WhatsappIntegrationConfig> | null,
): WhatsappIntegrationConfig {
  const providerId = partial?.providerId ?? DEFAULT_WHATSAPP_INTEGRATION.providerId;
  return {
    ...DEFAULT_WHATSAPP_INTEGRATION,
    ...partial,
    providerId: isWhatsappProviderId(providerId)
      ? providerId
      : DEFAULT_WHATSAPP_INTEGRATION.providerId,
    accountId: partial?.accountId?.trim() ?? "",
    phoneNumberId: partial?.phoneNumberId?.trim() ?? "",
    senderId: partial?.senderId?.trim() ?? "",
    apiBaseUrl: partial?.apiBaseUrl?.trim() ?? "",
  };
}
