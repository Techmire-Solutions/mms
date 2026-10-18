import {
  loadPlatformSmsIntegrationConfig,
  loadPlatformSmsIntegrationSecrets,
} from "./platformSmsIntegrationService.js";
import { sendTwilioSms } from "../sms/providers/twilioProvider.js";
import { sendVonageSms } from "../sms/providers/vonageProvider.js";
import { sendMsg91Sms } from "../sms/providers/msg91Provider.js";
import { sendInfobipSms } from "../sms/providers/infobipProvider.js";
import { sendTelesignSms } from "../sms/providers/telesignProvider.js";
import { sendLogiqueuesSms } from "../sms/providers/logiqueuesProvider.js";
import type { SmsProviderSender } from "../sms/providers/types.js";

export interface SendPlatformSmsInput {
  to: string;
  body: string;
}

export interface SendPlatformSmsResult {
  sent: boolean;
  reason?: "not_configured" | "transport_error";
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

async function dispatchViaActiveProvider(to: string, body: string): Promise<SendPlatformSmsResult> {
  const config = await loadPlatformSmsIntegrationConfig();
  const secrets = await loadPlatformSmsIntegrationSecrets();
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

/** Sends an SMS using the platform's configured provider. Caller is responsible for checking the notification-channel toggle. */
export async function sendPlatformSms(input: SendPlatformSmsInput): Promise<SendPlatformSmsResult> {
  return dispatchViaActiveProvider(input.to, input.body);
}

/** Quick connectivity check for the active provider — sends a real SMS to `testPhone`. */
export async function verifyPlatformSmsTransport(
  testPhone: string,
): Promise<SendPlatformSmsResult> {
  return dispatchViaActiveProvider(testPhone, "Your MMS platform SMS integration is working.");
}
