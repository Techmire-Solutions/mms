import type { EmailIntegrationConfig } from "./emailIntegrationTypes.js";
import type { SmsIntegrationConfig } from "./smsIntegrationTypes.js";

/**
 * Machine-readable validation outcomes for SMS integration forms.
 * Consumers map each code to a localized message key.
 */
export const SMS_INTEGRATION_VALIDATION_ERRORS = [
  "invalid_provider",
  "invalid_account_id",
  "invalid_sender_id",
  "invalid_secret",
  "invalid_base_url",
  "invalid_test_phone",
] as const;

export type SmsIntegrationValidationError = (typeof SMS_INTEGRATION_VALIDATION_ERRORS)[number];

/**
 * Machine-readable validation outcomes for email integration forms.
 * Consumers map each code to a localized message key.
 */
export const EMAIL_INTEGRATION_VALIDATION_ERRORS = [
  "invalid_provider",
  "invalid_from_address",
  "invalid_username",
  "invalid_password",
  "invalid_host",
  "invalid_port",
] as const;

export type EmailIntegrationValidationError = (typeof EMAIL_INTEGRATION_VALIDATION_ERRORS)[number];

/** Providers whose `accountId` field is unused by the SMS API. */
const SMS_PROVIDERS_WITHOUT_ACCOUNT_ID = new Set(["msg91", "infobip", "logiqueues"]);

/** Logiqueues derives the sender from the paired SIM; no sender id is required. */
const SMS_PROVIDERS_WITHOUT_SENDER_ID = new Set(["logiqueues"]);

export interface SmsIntegrationValidationOptions {
  /** Whether the selected provider preset requires a base URL (Infobip / Logiqueues). */
  requiresBaseUrl: boolean;
  /** Whether a secret was entered or credentials are already stored server-side. */
  accountSecretProvided: boolean;
  /** Optional test phone number entered when running a test send. */
  testPhone?: string;
}

/**
 * Validates an SMS integration form against the provider's requirements.
 * Pure and provider-agnostic: returns an error code or `null` when valid.
 */
export function validateSmsIntegrationConfig(
  config: SmsIntegrationConfig,
  options: SmsIntegrationValidationOptions,
): SmsIntegrationValidationError | null {
  if (!config.providerId) return "invalid_provider";
  if (!SMS_PROVIDERS_WITHOUT_ACCOUNT_ID.has(config.providerId) && !config.accountId.trim()) {
    return "invalid_account_id";
  }
  if (!SMS_PROVIDERS_WITHOUT_SENDER_ID.has(config.providerId) && !config.senderId.trim()) {
    return "invalid_sender_id";
  }
  if (!config.hasCredentials && !options.accountSecretProvided) return "invalid_secret";
  if (options.requiresBaseUrl) {
    if (!config.apiBaseUrl?.trim()) return "invalid_base_url";
    try {
      new URL(config.apiBaseUrl.trim());
    } catch {
      return "invalid_base_url";
    }
  }
  if (options.testPhone !== undefined && !/^\+?\d{7,15}$/.test(options.testPhone.trim())) {
    return "invalid_test_phone";
  }
  return null;
}

export interface EmailIntegrationValidationOptions {
  /** Whether a password was entered or credentials are already stored server-side. */
  smtpPasswordProvided: boolean;
}

/**
 * Validates an email integration form against the provider's requirements.
 * Pure and provider-agnostic: returns an error code or `null` when valid.
 */
export function validateEmailIntegrationConfig(
  config: EmailIntegrationConfig,
  options: EmailIntegrationValidationOptions,
): EmailIntegrationValidationError | null {
  if (!config.providerId?.trim()) return "invalid_provider";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.fromAddress?.trim() ?? "")) {
    return "invalid_from_address";
  }
  if (!config.smtpUsername?.trim()) return "invalid_username";
  if (!config.hasCredentials && !options.smtpPasswordProvided) return "invalid_password";
  if (config.providerId === "custom_smtp") {
    if (!config.smtpHost?.trim()) return "invalid_host";
    if (
      !Number.isInteger(config.smtpPort) ||
      (config.smtpPort ?? 0) < 1 ||
      (config.smtpPort ?? 0) > 65535
    ) {
      return "invalid_port";
    }
  }
  return null;
}
