import {
  canSendEmailNotifications,
  type GlobalSettings,
  type SendEmailInput,
  type SendEmailResult,
} from "@mms/shared";
import {
  createSmtpTransporter,
  resolveSmtpTransportOptions,
  sendMailViaSmtp,
  verifySmtpConnection,
} from "../../lib/smtpTransport.js";
import {
  loadEmailIntegrationConfig,
  loadEmailIntegrationSecrets,
} from "./emailIntegrationService.js";
import { loadGlobalSettings as loadTenantGlobalSettings } from "../globalSettingsService.js";

// Re-exported for consumers that imported the tenant-local names.
export type { SendEmailInput, SendEmailResult };

async function createTransporter() {
  const config = await loadEmailIntegrationConfig();
  const secrets = await loadEmailIntegrationSecrets();
  const smtp = resolveSmtpTransportOptions(config, secrets.smtpPassword ?? "");
  if (!smtp) return { config, transporter: null };
  return { config, transporter: createSmtpTransporter(smtp) };
}

/**
 * Sends an email using the tenant's configured SMTP provider when notifications are enabled.
 */
export async function sendTenantEmail(
  input: SendEmailInput,
  settings?: GlobalSettings,
): Promise<SendEmailResult> {
  const globalSettings = settings ?? (await loadTenantGlobalSettings());
  if (!canSendEmailNotifications(globalSettings)) {
    return { sent: false, reason: "notifications_disabled" };
  }

  const { config, transporter } = await createTransporter();
  if (!transporter) {
    return { sent: false, reason: "not_configured" };
  }

  const outcome = await sendMailViaSmtp(
    transporter,
    {
      from: config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    },
    "Failed to send email",
  );
  if (!outcome.sent) {
    return { sent: false, reason: "transport_error", message: outcome.message };
  }
  return { sent: true };
}

/** Quick connectivity check for the active provider. */
export async function verifyEmailTransport(): Promise<SendEmailResult> {
  const { transporter } = await createTransporter();
  if (!transporter) {
    return { sent: false, reason: "not_configured" };
  }
  const outcome = await verifySmtpConnection(transporter, "SMTP verification failed");
  if (!outcome.ok) {
    return { sent: false, reason: "transport_error", message: outcome.message };
  }
  return { sent: true };
}
