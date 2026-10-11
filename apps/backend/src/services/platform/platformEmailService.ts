import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getEmailProviderPreset, type EmailIntegrationConfig } from "@mms/shared";
import { fetchWithTimeout, isBlockedHostname } from "../../lib/outboundUrl.js";
import { SMTP_TIMEOUT_OPTIONS } from "../../lib/outboundTimeouts.js";
import { logger } from "../../lib/logger.js";
import { isDevCredentialLoggingEnabled, maskEmail } from "../../lib/devLogging.js";
import {
  loadPlatformEmailIntegrationConfig,
  loadPlatformEmailIntegrationSecrets,
} from "./platformEmailIntegrationService.js";

export interface PlatformEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface PlatformEmailResult {
  sent: boolean;
  reason?: "not_configured" | "transport_error";
  message?: string;
}

import {
  readEnv,
  isPlatformSmtpTransportConfigured,
  isPlatformResendConfigured,
  isPlatformSmtpConfigured,
  platformFromHeader,
  resolvePlatformAppOrigin,
} from "./platformEmailConfig.js";

export { isPlatformSmtpConfigured, resolvePlatformAppOrigin };

async function sendViaResend(input: PlatformEmailInput): Promise<PlatformEmailResult> {
  const apiKey = readEnv("PLATFORM_RESEND_API_KEY");
  if (!apiKey || !readEnv("PLATFORM_EMAIL_FROM")) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    // Bound the call: a hung provider must not hold the request open until the
    // global request timeout. `fetchWithTimeout` applies OUTBOUND_FETCH_TIMEOUT_MS.
    const response = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: platformFromHeader(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html ?? `<p>${input.text.replace(/\n/g, "<br/>")}</p>`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        sent: false,
        reason: "transport_error",
        message: body || `Resend API failed (${response.status})`,
      };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend request failed";
    return { sent: false, reason: "transport_error", message };
  }
}

function createPlatformTransporter(): Transporter | null {
  if (!isPlatformSmtpTransportConfigured()) return null;

  const host = readEnv("PLATFORM_SMTP_HOST");
  // SSRF guard: never connect SMTP to private / link-local / loopback hosts.
  if (isBlockedHostname(host)) return null;

  const port = Number(readEnv("PLATFORM_SMTP_PORT") || "587");
  const secure = readEnv("PLATFORM_SMTP_SECURE") === "true";

  return nodemailer.createTransport({
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure,
    auth: {
      user: readEnv("PLATFORM_SMTP_USER"),
      pass: readEnv("PLATFORM_SMTP_PASS"),
    },
    // Explicit budget — nodemailer's socketTimeout default is 10 minutes.
    ...SMTP_TIMEOUT_OPTIONS,
  });
}

async function sendViaSmtp(input: PlatformEmailInput): Promise<PlatformEmailResult> {
  const transporter = createPlatformTransporter();
  if (!transporter) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    await transporter.sendMail({
      from: platformFromHeader(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<p>${input.text.replace(/\n/g, "<br/>")}</p>`,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send platform email";
    return { sent: false, reason: "transport_error", message };
  }
}

function resolveDbSmtpOptions(
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

  if (!host || !Number.isFinite(port) || port < 1 || isBlockedHostname(host)) return null;

  return { host, port, secure, auth: { user: config.smtpUsername, pass: password } };
}

async function sendViaDbConfig(input: PlatformEmailInput): Promise<PlatformEmailResult> {
  const config = await loadPlatformEmailIntegrationConfig();
  const secrets = await loadPlatformEmailIntegrationSecrets();
  const smtp = resolveDbSmtpOptions(config, secrets.smtpPassword ?? "");
  if (!smtp) return { sent: false, reason: "not_configured" };

  try {
    const transporter = nodemailer.createTransport({ ...smtp, ...SMTP_TIMEOUT_OPTIONS });
    await transporter.sendMail({
      from: config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<p>${input.text.replace(/\n/g, "<br/>")}</p>`,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send platform email";
    return { sent: false, reason: "transport_error", message };
  }
}

/** Sends apex platform email: DB-configured provider first (Settings → Platform Notifications), then falls back to env Resend/SMTP. */
export async function sendPlatformEmail(input: PlatformEmailInput): Promise<PlatformEmailResult> {
  const viaDb = await sendViaDbConfig(input);
  if (viaDb.sent || viaDb.reason === "transport_error") return viaDb;

  if (isPlatformResendConfigured()) {
    return sendViaResend(input);
  }
  return sendViaSmtp(input);
}

/** Connectivity check against only the DB-configured provider (used by the Settings test-send button). */
export async function verifyPlatformEmailTransport(): Promise<PlatformEmailResult> {
  const config = await loadPlatformEmailIntegrationConfig();
  const secrets = await loadPlatformEmailIntegrationSecrets();
  const smtp = resolveDbSmtpOptions(config, secrets.smtpPassword ?? "");
  if (!smtp) return { sent: false, reason: "not_configured" };
  try {
    const transporter = nodemailer.createTransport({ ...smtp, ...SMTP_TIMEOUT_OPTIONS });
    await transporter.verify();
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP verification failed";
    return { sent: false, reason: "transport_error", message };
  }
}

export interface PlatformVerificationEmailInput {
  email: string;
  code: string;
  subject: string;
  bodyLines: string[];
  ttlMinutes: number;
  logLabel: string;
}

/**
 * Sends a platform OTP email.
 * Production: never returns or logs the OTP — callers must fail closed when `sent` is false.
 * Non-production: may return `devCode` so local setup works without SMTP.
 */
export async function dispatchPlatformVerificationEmail(
  input: PlatformVerificationEmailInput,
): Promise<{ sent: boolean; devCode?: string }> {
  const text = [
    ...input.bodyLines,
    "",
    input.code,
    "",
    `This code expires in ${input.ttlMinutes} minutes.`,
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  try {
    const result = await sendPlatformEmail({
      to: input.email,
      subject: input.subject,
      text,
    });

    if (result.sent) {
      return { sent: true };
    }

    const detail = result.message || "unknown";
    const devLog = isDevCredentialLoggingEnabled();
    logger.warn(
      {
        email: maskEmail(input.email),
        ...(devLog ? { code: input.code } : {}),
        detail,
        label: input.logLabel,
      },
      `email delivery failed${devLog ? " (dev logging enabled)" : ""}`,
    );
    return { sent: false, ...(devLog ? { devCode: input.code } : {}) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const devLog = isDevCredentialLoggingEnabled();
    logger.warn(
      {
        email: maskEmail(input.email),
        ...(devLog ? { code: input.code } : {}),
        detail,
        label: input.logLabel,
      },
      `email delivery threw${devLog ? " (dev logging enabled)" : ""}`,
    );
    return { sent: false, ...(devLog ? { devCode: input.code } : {}) };
  }
}
