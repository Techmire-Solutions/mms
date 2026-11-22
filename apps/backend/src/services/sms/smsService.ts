import {
  canSendSmsNotifications,
  type GlobalSettings,
  type SendSmsInput,
  type SendSmsResult,
} from "@mms/shared";
import { loadSmsIntegrationConfig, loadSmsIntegrationSecrets } from "./smsIntegrationService.js";
import { loadGlobalSettings as loadTenantGlobalSettings } from "../globalSettingsService.js";
import { sendSmsViaProvider } from "./sendSmsViaProvider.js";

// Re-exported for consumers that imported the tenant-local names.
export type { SendSmsInput, SendSmsResult };

async function dispatchViaActiveProvider(to: string, body: string): Promise<SendSmsResult> {
  return sendSmsViaProvider(
    async () => ({
      config: await loadSmsIntegrationConfig(),
      secrets: await loadSmsIntegrationSecrets(),
    }),
    { to, body },
  );
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
