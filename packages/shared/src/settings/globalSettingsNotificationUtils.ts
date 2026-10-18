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

export type NotificationChannel = "email" | "sms" | "none";

/**
 * Primary outbound channel for verification codes and system alerts.
 * Email takes precedence when both master toggles are enabled.
 */
export function resolveNotificationChannel(settings: GlobalSettings): NotificationChannel {
  if (canSendEmailNotifications(settings)) return "email";
  if (canSendSmsNotifications(settings)) return "sms";
  return "none";
}

/** Masks an email for display, e.g. `a***@madrasa.app`. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.charAt(0);
  return `${visible}***@${domain}`;
}
