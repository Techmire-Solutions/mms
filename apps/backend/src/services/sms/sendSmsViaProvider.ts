import type { SendSmsResult, SmsIntegrationConfig, SmsIntegrationSecrets } from "@mms/contracts";
import { sendTwilioSms } from "./providers/twilioProvider.js";
import { sendVonageSms } from "./providers/vonageProvider.js";
import { sendMsg91Sms } from "./providers/msg91Provider.js";
import { sendInfobipSms } from "./providers/infobipProvider.js";
import { sendTelesignSms } from "./providers/telesignProvider.js";
import { sendLogiqueuesSms } from "./providers/logiqueuesProvider.js";
import { sendGenericOutboundMessage } from "../messagingOutboundProvider.js";
import type { SmsProviderSender } from "./providers/types.js";

/**
 * SSOT for provider-based SMS dispatch shared by the tenant and platform
 * services (mms-dry §2): the provider map, credential validation, phone
 * sanitization, and the result envelope live here; each console supplies only
 * its own config+secrets loader.
 */

export type SmsProviderConfigLoader = () => Promise<{
  config: SmsIntegrationConfig;
  secrets: SmsIntegrationSecrets;
}>;

export interface SendSmsViaProviderOptions {
  to: string;
  body: string;
}

const PROVIDER_SENDERS: Record<string, SmsProviderSender> = {
  twilio: sendTwilioSms,
  vonage: sendVonageSms,
  msg91: sendMsg91Sms,
  infobip: sendInfobipSms,
  telesign: sendTelesignSms,
  logiqueues: sendLogiqueuesSms,
  custom: sendGenericOutboundMessage,
};

/**
 * Normalizes a recipient phone to the provider-safe shape: digits only,
 * preserving a leading `+` when present. Applied on both console paths — the
 * platform path previously sent the raw value (deliberate fix).
 */
export function sanitizeDispatchPhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/** Dispatches an SMS through the active provider using the loader's config. */
export async function sendSmsViaProvider(
  loadConfig: SmsProviderConfigLoader,
  options: SendSmsViaProviderOptions,
): Promise<SendSmsResult> {
  const { config, secrets } = await loadConfig();
  const accountSecret = secrets.accountSecret ?? "";

  const requiresSenderId = config.providerId !== "custom" && config.providerId !== "logiqueues";
  if (!accountSecret || (requiresSenderId && !config.senderId)) {
    return { sent: false, reason: "not_configured" };
  }

  const send = PROVIDER_SENDERS[config.providerId];
  if (!send) {
    return {
      sent: false,
      reason: "not_configured",
      message: `Unsupported SMS provider: ${config.providerId}`,
    };
  }

  const cleanPhone = sanitizeDispatchPhone(options.to);

  try {
    const result = await send(cleanPhone, options.body, {
      accountId: config.accountId,
      accountSecret,
      senderId: config.senderId,
      apiBaseUrl: config.apiBaseUrl,
    });
    if (!result.success) {
      return { sent: false, reason: "transport_error", message: result.error };
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send SMS";
    return { sent: false, reason: "transport_error", message };
  }
}
