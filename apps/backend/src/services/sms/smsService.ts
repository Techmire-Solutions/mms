import { canSendSmsNotifications, type GlobalSettings } from "@mms/shared";
import { loadSmsIntegrationConfig, loadSmsIntegrationSecrets } from "./smsIntegrationService.js";
import { loadGlobalSettings as loadTenantGlobalSettings } from "../globalSettingsService.js";
import { sendTwilioSms } from "./providers/twilioProvider.js";
import { sendVonageSms } from "./providers/vonageProvider.js";
import { sendMsg91Sms } from "./providers/msg91Provider.js";
import { sendInfobipSms } from "./providers/infobipProvider.js";
import { sendTelesignSms } from "./providers/telesignProvider.js";
import { sendLogiqueuesSms } from "./providers/logiqueuesProvider.js";
import type { SmsProviderSender } from "./providers/types.js";

export interface SendSmsInput {
  to: string;
  body: string;
}

export interface SendSmsResult {
  sent: boolean;
  reason?: "notifications_disabled" | "not_configured" | "transport_error";
  message?: string;
}

const PROVIDER_SENDERS: Record<string, SmsProviderSender> = {
  twilio: sendTwilioSms,
  vonage: sendVonageSms,
  msg91: sendMsg91Sms,
  infobip: sendInfobipSms,
  telesign: sendTelesignSms,
  logiqueues: sendLogiqueuesSms,
};

async function dispatchViaActiveProvider(to: string, body: string): Promise<SendSmsResult> {
  const config = await loadSmsIntegrationConfig();
  const secrets = await loadSmsIntegrationSecrets();
  const accountSecret = secrets.accountSecret ?? "";

  if (!accountSecret || !config.senderId) {
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

  try {
    const result = await send(to, body, {
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

/**
 * Sends an SMS using the tenant's configured provider when SMS notifications are enabled.
 */
export async function sendTenantSms(
  input: SendSmsInput,
  settings?: GlobalSettings,
): Promise<SendSmsResult> {
  const globalSettings = settings ?? (await loadTenantGlobalSettings());
  if (!canSendSmsNotifications(globalSettings)) {
    return { sent: false, reason: "notifications_disabled" };
  }

  return dispatchViaActiveProvider(input.to, input.body);
}

/** Quick connectivity check for the active provider — sends a real SMS to `testPhone`. */
export async function verifySmsTransport(testPhone: string): Promise<SendSmsResult> {
  return dispatchViaActiveProvider(testPhone, "Your MMS workspace SMS integration is working.");
}
