/** Contact display helpers — avatar, name, primary channels, email/name normalize. */
import { type Contact, type Address as ContactAddress } from "./contactTypes.js";
import { contactDisplayName } from "./contactLinkPolicy.js";
import { PuppeteerWhatsAppProvider } from "../messaging/whatsappProvider.js";
import { getPrimaryPhone } from "../core/phoneUtils.js";

// ── Icons & symbols for UI ─────────────────────────────────────────────────────

const AVATAR_COLORS: readonly string[] = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

// ── Utility functions ──────────────────────────────────────────────────────

/**
 * Get avatar color by contact ID
 * @param id - Contact ID
 * @returns CSS color class
 */
export function getAvatarColor(id: number | string): string {
  const numericId =
    typeof id === "number"
      ? id
      : String(id)
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[numericId % AVATAR_COLORS.length];
}

/**
 * Get initials from name
 * @param name - Contact name
 * @param length - Number of initials (default: 2)
 * @returns Initials string
 */
export function getInitials(name: string | null | undefined, length = 2): string {
  if (!name) return "?";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((namePart) => namePart[0])
      .join("")
      .slice(0, length)
      .toUpperCase() || "?"
  );
}

/**
 * Extract primary email from contact
 * @param contact - Contact object
 * @returns Primary email address or null.
 */
export function getPrimaryEmail(contact?: Partial<Contact> | null): string | null {
  if (!contact) return null;
  const emails = contact.emails || [];
  const emailObj =
    emails.find((e) => e.isPrimary && (e.address || "").trim().length > 0) ||
    emails.find((e) => (e.address || "").trim().length > 0) ||
    emails[0];
  if (emailObj && (emailObj.address || "").trim().length > 0) {
    return emailObj.address.trim();
  }
  const scalarEmail = (contact as Record<string, unknown>).email;
  return typeof scalarEmail === "string" && scalarEmail.trim().length > 0
    ? scalarEmail.trim()
    : null;
}

/**
 * Extract primary address object from contact
 * @param contact - Contact object
 * @returns Primary address object or null.
 */
export function getPrimaryAddress(contact?: Partial<Contact> | null): ContactAddress | null {
  if (!contact) return null;
  const addresses = contact.addresses || [];
  const addr = addresses.find((a) => a.isPrimary) || addresses[0];
  return addr || null;
}

/**
 * Build display name with Syed/Syeda prefix if applicable
 * Does NOT modify the stored name, only formats for display
 * @param contact - Contact object
 * @returns Formatted display name
 */
export function getDisplayName(contact: Partial<Contact>): string {
  const baseName = contactDisplayName({
    id: contact.id ?? "",
    name: contact.name,
    firstName: contact.firstName,
    lastName: contact.lastName,
  });
  if (!baseName || !contact.isSyed) return baseName;

  const prefix = contact.gender === "male" ? "Syed " : contact.gender === "female" ? "Syeda " : "";
  return prefix ? `${prefix}${baseName}` : baseName;
}

/**
 * Check if contact has a WhatsApp-resolvable number (`PuppeteerWhatsAppProvider.getNumberId`).
 * @param contact - Contact object
 * @returns True when a WhatsApp number id can be resolved from the primary phone.
 */
export function hasWhatsApp(contact: Partial<Contact>): boolean {
  return !!PuppeteerWhatsAppProvider.getNumberId(getPrimaryPhone(contact));
}

// ── Normalization Helpers ───────────────────────────────────────────────────

const normalizeEmail = (email: unknown): string => {
  if (!email) return "";
  return String(email).trim().toLowerCase();
};

export const getEmails = (contact?: Contact | null): string[] => {
  if (!contact) return [];
  const emails: string[] = [];
  if (Array.isArray(contact.emails)) {
    contact.emails.forEach((email) => {
      if (email?.address) {
        emails.push(normalizeEmail(email.address));
      }
    });
  }
  if (contact.email) {
    emails.push(normalizeEmail(contact.email));
  }
  return Array.from(new Set(emails.filter(Boolean)));
};

/**
 * Builds the anchored prefix-strip regex source used for name comparison.
 * Prefixes are normalized (lower/trim/dedupe) and regex-escaped so the same
 * pattern can be bound in both JS (`new RegExp`) and Postgres `regexp_replace`
 * without the two normalizations drifting apart.
 */
export const buildNamePrefixRegex = (prefixesToIgnore?: string[]): string => {
  if (!prefixesToIgnore || prefixesToIgnore.length === 0) return "";
  const normalized = Array.from(
    new Set(
      prefixesToIgnore
        .map((prefix) => String(prefix).trim().toLowerCase())
        .filter(Boolean)
        .map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    ),
  );
  if (normalized.length === 0) return "";
  return `^(${normalized.join("|")})\\s+`;
};

export const cleanName = (name: unknown, prefixesToIgnore?: string[]): string => {
  if (!name) return "";
  const clean = String(name).trim().toLowerCase();
  const prefixRegex = buildNamePrefixRegex(prefixesToIgnore);
  if (prefixRegex) {
    return clean.replace(new RegExp(prefixRegex), "").replace(/\s+/g, "");
  }
  return clean.replace(/\s+/g, "");
};
