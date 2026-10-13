import {
  formatPhoneWithCountryCode,
  normalizeToE164,
  parsePhoneNumber,
} from "../core/phoneUtils.js";
import { PuppeteerWhatsAppProvider } from "../messaging/whatsappProvider.js";

/**
 * Sanitizes a phone number into a valid tel: protocol URI.
 * @example "+92 300 1234567" -> "tel:+923001234567"
 * @returns Sanitized "tel:+..." href or null if empty/invalid.
 */
export function sanitizePhoneForTel(
  phone: string | null | undefined,
  defaultCountryCode = "",
): string | null {
  if (!phone || !String(phone).trim()) return null;
  const raw = String(phone).trim();
  const parsed = parsePhoneNumber(raw, defaultCountryCode);
  const code = (parsed.countryCode || defaultCountryCode).trim();
  const number = (parsed.number || "").trim();
  if (!number && !raw.startsWith("+")) return null;

  const normalized = normalizeToE164(code, number || raw);
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 5) return null;
  return `tel:${code ? normalized : digits}`;
}

/**
 * Sanitizes a phone number into a valid sms: protocol URI.
 * @example "+92 300 1234567" -> "sms:+923001234567"
 * @returns Sanitized "sms:+..." href or null if empty/invalid.
 */
export function sanitizePhoneForSms(
  phone: string | null | undefined,
  defaultCountryCode = "",
): string | null {
  if (!phone || !String(phone).trim()) return null;
  const raw = String(phone).trim();
  const parsed = parsePhoneNumber(raw, defaultCountryCode);
  const code = (parsed.countryCode || defaultCountryCode).trim();
  const number = (parsed.number || "").trim();
  if (!number && !raw.startsWith("+")) return null;

  const normalized = normalizeToE164(code, number || raw);
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 5) return null;
  return `sms:${code ? normalized : digits}`;
}

/**
 * Sanitizes a phone number into a direct https://wa.me/ link.
 * Uses PuppeteerWhatsAppProvider.getNumberId to ensure valid international digits.
 * @example "+92 300 1234567" -> "https://wa.me/923001234567"
 * @returns "https://wa.me/{numberId}" or null if not a valid WhatsApp number.
 */
export function sanitizePhoneForWhatsApp(
  phone: string | null | undefined,
  defaultCountryCode = "",
): string | null {
  if (!phone || !String(phone).trim()) return null;
  const raw = String(phone).trim();
  const parsed = parsePhoneNumber(raw, defaultCountryCode);
  if (!parsed.countryCode) return null;
  const formatted = formatPhoneWithCountryCode(raw, defaultCountryCode);
  const numberId = PuppeteerWhatsAppProvider.getNumberId(formatted || raw);
  if (!numberId) return null;
  return `https://wa.me/${numberId}`;
}

/**
 * Sanitizes an email address into a valid mailto: protocol URI.
 * @example "contact@example.com" -> "mailto:contact@example.com"
 * @returns Sanitized "mailto:..." href or null if empty/invalid.
 */
export function sanitizeEmailForMailto(email: string | null | undefined): string | null {
  if (!email || !String(email).trim()) return null;
  const clean = String(email).trim();
  // Basic sanity check for valid email characters without controls or whitespace
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return null;
  return `mailto:${clean}`;
}

/**
 * Bundles sanitized action hrefs for a phone number.
 */
export function getContactPhoneActionHrefs(
  phone: string | null | undefined,
  defaultCountryCode = "",
): {
  tel: string | null;
  sms: string | null;
  whatsapp: string | null;
} {
  return {
    tel: sanitizePhoneForTel(phone, defaultCountryCode),
    sms: sanitizePhoneForSms(phone, defaultCountryCode),
    whatsapp: sanitizePhoneForWhatsApp(phone, defaultCountryCode),
  };
}
