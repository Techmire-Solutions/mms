import { TENANT_PASSWORD_OTP_TTL_MINUTES, resolveNotificationChannel } from "@mms/shared";
import { loadGlobalSettings } from "../globalSettingsService.js";
import { sendTenantEmail } from "../email/emailService.js";
import { sendTenantSms } from "../sms/smsService.js";
import { getContactById } from "../contactService.js";
import type { StoredUser } from "./userService.js";
import { logger } from "../../lib/logger.js";

const WELCOME_EMAIL_FAILURE_MESSAGES: Record<string, string> = {
  notifications_disabled:
    "Email notifications are turned off in Settings → General → Notifications.",
  not_configured: "No outgoing mail server is configured in Settings → General → Notifications.",
};

/**
 * Sends a plain, tokenless "welcome" link for a newly-created (invite-method) user.
 * Supports email, SMS, or both depending on workspace notification settings.
 * Never throws — reports `sent`.
 */
export async function sendTenantWelcomeEmail(input: {
  workspaceSubdomain: string;
  email: string;
  name: string;
  origin: string;
  phone?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const link = `${input.origin.replace(/\/$/, "")}/forgot-password?activate=1`;
  const settings = await loadGlobalSettings();
  const channel = resolveNotificationChannel(settings);
  const text = `Hi ${input.name},\n\nYou've been added as a user on MMS. Activate your account and set your password:\n${link}`;

  let emailSent = false;
  let smsSent = false;
  let error: string | undefined;

  if (channel === "both" || channel === "email" || channel === "none") {
    const result = await sendTenantEmail({
      to: input.email,
      subject: `You're invited to join ${input.workspaceSubdomain} on MMS`,
      text,
      html: `<p>Hi ${input.name},</p><p>You've been added as a user. Activate your account and set your password:</p><p><a href="${link}">${link}</a></p>`,
    });
    emailSent = Boolean(result.sent);
    if (!result.sent) {
      error =
        result.message ||
        (result.reason && WELCOME_EMAIL_FAILURE_MESSAGES[result.reason]) ||
        "The welcome email could not be sent.";
      logger.warn(
        { email: input.email, reason: result.reason, error },
        "Tenant welcome email failed to send",
      );
    }
  }

  if ((channel === "both" || channel === "sms") && input.phone) {
    const result = await sendTenantSms({ to: input.phone, body: text }, settings);
    smsSent = Boolean(result.sent);
    if (!result.sent) {
      logger.warn(
        { phone: input.phone, reason: result.reason },
        "Tenant welcome SMS failed to send",
      );
    }
  }

  const sent = emailSent || smsSent;
  if (!sent && process.env.NODE_ENV !== "production") {
    logger.info({ email: input.email, link }, "Tenant welcome link (dev, not sent)");
  }

  return { sent, error: sent ? undefined : error };
}

/**
 * Dispatches one-time verification code for password reset via active notification channels
 * (email, SMS, or both).
 */
export async function dispatchTenantPasswordOtp(
  email: string,
  user: StoredUser,
  code: string,
): Promise<void> {
  const settings = await loadGlobalSettings();
  const channel = resolveNotificationChannel(settings);
  const text = `Your verification code is ${code}. It expires in ${TENANT_PASSWORD_OTP_TTL_MINUTES} minutes.\n\nIf you didn't request this, you can ignore this message.`;

  let emailSent = false;
  let smsSent = false;

  if (channel === "both" || channel === "email" || channel === "none") {
    const res = await sendTenantEmail({
      to: email,
      subject: "Your MMS verification code",
      text,
      html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in ${TENANT_PASSWORD_OTP_TTL_MINUTES} minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
    });
    emailSent = Boolean(res.sent);
  }

  if (channel === "both" || channel === "sms") {
    const contact = user.contactId != null ? await getContactById(String(user.contactId)) : null;
    if (contact?.phone) {
      const res = await sendTenantSms({ to: contact.phone, body: text }, settings);
      smsSent = Boolean(res.sent);
      if (!res.sent) {
        logger.warn({ channel, reason: res.reason }, "Tenant password OTP SMS dispatch failed");
      }
    } else {
      logger.warn({ channel }, "Tenant password OTP SMS channel active but contact has no phone");
    }
  }

  if (!emailSent && !smsSent && process.env.NODE_ENV !== "production") {
    logger.info({ email, code }, "Tenant password OTP (dev, not sent)");
  }
}
