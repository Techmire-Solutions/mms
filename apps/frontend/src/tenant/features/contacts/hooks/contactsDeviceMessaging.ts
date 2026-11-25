import {
  buildDeviceSmsUri,
  getPrimaryEmail,
  getPrimaryPhone,
  sanitizePhoneForWhatsApp,
  type Contact,
} from "@mms/contracts";
import { openDeviceSmsComposer } from "@/lib/deviceSms";

export type ContactMessagingChannel = "whatsapp" | "sms" | "email";

/**
 * Device deep link (wa.me / sms: / mailto:) for one contact's primary address, or
 * `null` when the contact has no address for the channel. Used when the in-app
 * composer is unavailable, matching the plain links the phone/email cells render.
 */
export function buildContactDeviceChannelUri(
  channel: ContactMessagingChannel,
  contact: Contact,
): string | null {
  if (channel === "email") {
    const email = getPrimaryEmail(contact)?.trim();
    // Encode everything except `@` so a stray `?`/`#` cannot inject mailto headers.
    return email ? `mailto:${encodeURIComponent(email).replaceAll("%40", "@")}` : null;
  }
  const phone = getPrimaryPhone(contact);
  if (!phone) return null;
  return channel === "sms" ? buildDeviceSmsUri(phone) : sanitizePhoneForWhatsApp(phone);
}

/** Opens the device channel for one contact; returns false when there is no address. */
export function openContactDeviceChannel(
  channel: ContactMessagingChannel,
  contact: Contact,
): boolean {
  if (channel === "sms") {
    const phone = getPrimaryPhone(contact);
    return phone ? openDeviceSmsComposer(phone) : false;
  }
  const uri = buildContactDeviceChannelUri(channel, contact);
  if (!uri) return false;
  // Same hand-off the composer's "WhatsApp Web / App" and email modes use.
  window.open(uri, "_blank", "noopener,noreferrer");
  return true;
}
