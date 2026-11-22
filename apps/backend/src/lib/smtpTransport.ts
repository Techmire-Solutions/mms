import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getEmailProviderPreset, type EmailIntegrationConfig } from "@mms/shared";
import { isBlockedHostname } from "./outboundUrl.js";
import { SMTP_TIMEOUT_OPTIONS } from "./outboundTimeouts.js";

/**
 * SSOT for SMTP connection resolution, transporter creation, and the
 * HTML-fallback mail assembly shared by the tenant and platform email paths
 * (mms-dry §2).
 *
 * The derived HTML part is ALWAYS built from HTML-escaped plain text here, so
 * neither console can regress to injecting raw `input.text` into HTML.
 */

export interface SmtpTransportOptions {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
}

/**
 * Resolves concrete SMTP connection options from a stored integration config.
 * Preset lookup for well-known providers, `custom_smtp` overrides, the SSRF
 * host guard, and port validation live in one place so the tenant and platform
 * DB-config paths cannot drift apart.
 */
export function resolveSmtpTransportOptions(
  config: EmailIntegrationConfig,
  password: string,
): SmtpTransportOptions | null {
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

/**
 * Creates a nodemailer transporter with the project's explicit SMTP timeout
 * budget — nodemailer's socketTimeout default is 10 minutes, which would let a
 * stalled SMTP server pin the sending caller that long.
 */
export function createSmtpTransporter(options: SmtpTransportOptions): Transporter {
  return nodemailer.createTransport({
    ...options,
    ...SMTP_TIMEOUT_OPTIONS,
  });
}

/** HTML-escapes plain text before it is wrapped into the derived email HTML part. */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Builds the derived HTML part for plain-text emails (escaped + `<br/>` line breaks). */
export function buildHtmlFallback(text: string): string {
  return `<p>${escapeHtmlText(text).replace(/\n/g, "<br/>")}</p>`;
}

export interface SmtpMailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  /** Explicit HTML body; when absent the escaped text-derived fallback is used. */
  html?: string;
}

export type SmtpSendOutcome = { sent: true } | { sent: false; message: string };

/**
 * Sends a message through a prepared transporter using the shared
 * HTML-fallback assembly. Callers map the outcome onto their own result
 * envelopes (reason unions differ per console).
 */
export async function sendMailViaSmtp(
  transporter: Transporter,
  message: SmtpMailMessage,
  fallbackFailureMessage: string,
): Promise<SmtpSendOutcome> {
  try {
    await transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html ?? buildHtmlFallback(message.text),
    });
    return { sent: true };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : fallbackFailureMessage;
    return { sent: false, message: messageText };
  }
}

export type SmtpVerifyOutcome = { ok: true } | { ok: false; message: string };

/** Connectivity check (`transporter.verify`) with the shared error mapping. */
export async function verifySmtpConnection(
  transporter: Transporter,
  fallbackFailureMessage: string,
): Promise<SmtpVerifyOutcome> {
  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : fallbackFailureMessage;
    return { ok: false, message: messageText };
  }
}
