import type { SendSmsInput, SendSmsResult } from "@mms/contracts";
import {
  loadPlatformSmsIntegrationConfig,
  loadPlatformSmsIntegrationSecrets,
} from "./platformSmsIntegrationService.js";
import { sendSmsViaProvider } from "../sms/sendSmsViaProvider.js";

/**
 * Platform send types are the shared superset shapes; the platform path simply
 * never produces the `notifications_disabled` reason (the caller owns the
 * channel toggle). Names kept for backward compatibility.
 */
export type SendPlatformSmsInput = SendSmsInput;
export type SendPlatformSmsResult = SendSmsResult;

async function dispatchViaActiveProvider(to: string, body: string): Promise<SendPlatformSmsResult> {
  return sendSmsViaProvider(
    async () => ({
      config: await loadPlatformSmsIntegrationConfig(),
      secrets: await loadPlatformSmsIntegrationSecrets(),
    }),
    { to, body },
  );
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
