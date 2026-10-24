import { canSendWhatsAppNotifications, type GlobalSettings } from "@mms/shared";
import {
  loadWhatsappIntegrationConfig,
  loadWhatsappIntegrationSecrets,
} from "./whatsappIntegrationService.js";
import { loadGlobalSettings as loadTenantGlobalSettings } from "../globalSettingsService.js";
import { sendMetaWhatsApp } from "./providers/metaProvider.js";
import { sendTwilioWhatsApp } from "./providers/twilioWhatsAppProvider.js";
import { sendInfobipWhatsApp } from "./providers/infobipWhatsAppProvider.js";
import type { WhatsappProviderSender } from "./providers/types.js";

export interface SendWhatsappInput {
  to: string;
  body: string;
}

export interface SendWhatsappResult {
  sent: boolean;
  reason?: "notifications_disabled" | "not_configured" | "transport_error";
  message?: string;
  providerMessageId?: string;
}

const PROVIDER_SENDERS: Record<string, WhatsappProviderSender> = {
  meta: sendMetaWhatsApp,
  twilio: sendTwilioWhatsApp,
  infobip: sendInfobipWhatsApp,
};

function sanitizeDispatchPhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

async function dispatchViaActiveProvider(to: string, body: string): Promise<SendWhatsappResult> {
  const config = await loadWhatsappIntegrationConfig();
  const secrets = await loadWhatsappIntegrationSecrets();
  const accountSecret = secrets.accountSecret ?? "";

  if (!accountSecret || !config.senderId) {
    return { sent: false, reason: "not_configured" };
  }

  const send = PROVIDER_SENDERS[config.providerId];
  if (!send) {
    return {
      sent: false,
      reason: "not_configured",
      message: `Unsupported WhatsApp provider: ${config.providerId}`,
    };
  }

  const cleanPhone = sanitizeDispatchPhone(to);

  try {
    const result = await send(cleanPhone, body, {
      accountId: config.accountId,
      phoneNumberId: config.phoneNumberId,
      accountSecret,
      senderId: config.senderId,
      apiBaseUrl: config.apiBaseUrl,
    });
    if (!result.success) {
      return { sent: false, reason: "transport_error", message: result.error };
    }
    return { sent: true, providerMessageId: result.providerMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send WhatsApp message";
    return { sent: false, reason: "transport_error", message };
  }
}

/**
 * Sends a WhatsApp message using the tenant's configured provider when notifications are enabled.
 */
export async function sendTenantWhatsApp(
  input: SendWhatsappInput,
  settings?: GlobalSettings,
): Promise<SendWhatsappResult> {
  const globalSettings = settings ?? (await loadTenantGlobalSettings());
  if (!canSendWhatsAppNotifications(globalSettings)) {
    return { sent: false, reason: "notifications_disabled" };
  }

  return dispatchViaActiveProvider(input.to, input.body);
}

/** Quick connectivity check for the active WhatsApp provider. */
export async function verifyWhatsAppTransport(testPhone: string): Promise<SendWhatsappResult> {
  return dispatchViaActiveProvider(
    testPhone,
    "Your MMS workspace WhatsApp integration is active and connected.",
  );
}
