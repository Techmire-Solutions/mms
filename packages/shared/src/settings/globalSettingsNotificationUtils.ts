import type { GlobalSettings } from "./globalSettingsTypes.js";

/**
 * Whether the signed-in user must complete 2FA before accessing the app.
 * Global `twoFactor` enforces admin logins; per-user flag can extend later.
 */
export function requiresTwoFactor(
  settings: GlobalSettings,
  user: { role: string; twoFactorEnabled?: boolean } | null,
): boolean {
  if (!user) return false;
  if (user.twoFactorEnabled) return true;
  return settings.twoFactor === true && user.role === "admin";
}

/** Master email notifications gate from global settings. */
export function canSendEmailNotifications(settings: GlobalSettings): boolean {
  return settings.emailNotifications === true;
}

/** Master SMS notifications gate from global settings. */
export function canSendSmsNotifications(settings: GlobalSettings): boolean {
  return settings.smsNotifications === true;
}

/** Master WhatsApp notifications gate from global settings. */
export function canSendWhatsAppNotifications(settings: GlobalSettings): boolean {
  return settings.whatsAppNotifications === true;
}

export const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp", "both", "all", "none"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * Returns list of all active notification channel types.
 */
export function getActiveNotificationChannels(
  settings: GlobalSettings,
): ("email" | "sms" | "whatsapp")[] {
  const list: ("email" | "sms" | "whatsapp")[] = [];
  if (canSendEmailNotifications(settings)) list.push("email");
  if (canSendSmsNotifications(settings)) list.push("sms");
  if (canSendWhatsAppNotifications(settings)) list.push("whatsapp");
  return list;
}

/**
 * Primary outbound channel for verification codes and system alerts.
 * Returns "both" when both email and SMS master toggles are enabled.
 */
export function resolveNotificationChannel(settings: GlobalSettings): NotificationChannel {
  const email = canSendEmailNotifications(settings);
  const sms = canSendSmsNotifications(settings);
  const whatsapp = canSendWhatsAppNotifications(settings);
  if (email && sms && whatsapp) return "all";
  if (email && sms) return "both";
  if (email) return "email";
  if (sms) return "sms";
  if (whatsapp) return "whatsapp";
  return "none";
}

/** Masks an email for display, e.g. `a***@madrasa.app`. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.charAt(0);
  return `${visible}***@${domain}`;
}
