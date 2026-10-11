import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import {
  canSendEmailNotifications,
  getEmailProviderPreset,
  type EmailIntegrationConfig,
  type GlobalSettings,
} from "@mms/shared";
import {
  loadEmailIntegrationConfig,
  loadEmailIntegrationSecrets,
} from "./emailIntegrationService.js";
import { loadGlobalSettings as loadTenantGlobalSettings } from "../globalSettingsService.js";
import { isBlockedHostname } from "../../lib/outboundUrl.js";
import { SMTP_TIMEOUT_OPTIONS } from "../../lib/outboundTimeouts.js";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: "notifications_disabled" | "not_configured" | "transport_error";
  message?: string;
}

function resolveSmtpOptions(
  config: EmailIntegrationConfig,
  password: string,
): { host: string; port: number; secure: boolean; auth: { user: string; pass: string } } | null {
  if (!config.smtpUsername || !password || !config.fromAddress) return null;

  const preset = getEmailProviderPreset(config.providerId);
  const host = config.providerId === "custom_smtp" ? config.smtpHost?.trim() : preset.smtp.host;
  const port =
    config.providerId === "custom_smtp"
      ? Number(config.smtpPort ?? preset.smtp.port)
      : preset.smtp.port;
  const secure =
    config.providerId === "custom_smtp" ? config.smtpSecure === true : preset.smtp.secure;

  if (!host || !Number.isFinite(port) || port < 1) return null;

  // SSRF guard: never connect SMTP to private / link-local / loopback hosts.
  if (isBlockedHostname(host)) return null;

  return {
    host,
    port,
    secure,
    auth: {
      user: config.smtpUsername,
      pass: password,
    },
  };
}

async function createTransporter(config: EmailIntegrationConfig): Promise<Transporter | null> {
  const secrets = await loadEmailIntegrationSecrets();
  const password = secrets.smtpPassword ?? "";
  const smtp = resolveSmtpOptions(config, password);
  if (!smtp) return null;

  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
    // Explicit budget — nodemailer's socketTimeout default is 10 minutes, which
    // would let a stalled SMTP server pin the sending caller that long.
    ...SMTP_TIMEOUT_OPTIONS,
  });
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

  const config = await loadEmailIntegrationConfig();
  const transporter = await createTransporter(config);
  if (!transporter) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    await transporter.sendMail({
      from: config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<p>${input.text.replace(/\n/g, "<br/>")}</p>`,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    return { sent: false, reason: "transport_error", message };
  }
}

/** Quick connectivity check for the active provider. */
export async function verifyEmailTransport(): Promise<SendEmailResult> {
  const config = await loadEmailIntegrationConfig();
  const transporter = await createTransporter(config);
  if (!transporter) {
    return { sent: false, reason: "not_configured" };
  }
  try {
    await transporter.verify();
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP verification failed";
    return { sent: false, reason: "transport_error", message };
  }
}
