import type { Contact } from "../contacts/contactTypes.js";
import { generateClientEntityId } from "./clientEntityIdUtils.js";
import { normalizeToE164, parsePhoneNumber } from "./utils.js";
import { todayISO } from "./utils.js";

/**
 * Options for parsing a vCard text block into Contact records.
 */
export interface ParseVCardOptions {
  /** Label for generated mobile phone entries (default: 'Mobile'). */
  mobileLabel?: string;
  /** Label for generated email entries (default: 'Personal'). */
  personalLabel?: string;
  /** Tenant-configured phone country code for parsing local numbers. */
  defaultPhoneCountryCode?: string;
}

/**
 * Parses a raw vCard (.vcf) formatted string into an array of normalized Contact objects.
 *
 * @param text - The raw vCard content string.
 * @param options - Optional label and country code configuration.
 * @returns Array of parsed Contact objects.
 */
export function parseVCard(text: string, options?: ParseVCardOptions): Contact[] {
  const mobileLabel = options?.mobileLabel || "Mobile";
  const personalLabel = options?.personalLabel || "Personal";
  const defaultPhoneCountryCode = options?.defaultPhoneCountryCode?.trim() ?? "";

  const contacts: Contact[] = [];
  const cards = text.split(/BEGIN:VCARD/i).filter((cardText) => cardText.trim());

  for (const card of cards) {
    const get = (key: string): string => {
      const re = new RegExp(`^${key}[^:]*:(.*)$`, "im");
      const match = card.match(re);
      return match ? match[1].trim() : "";
    };

    const name = get("FN");
    if (!name) continue;

    const nameParts = name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");

    const phone = (card.match(/^TEL[^:]*:(.+)$/im) || [])[1]?.trim() || "";
    const parsedRaw = parsePhoneNumber(phone, defaultPhoneCountryCode);
    const e164 = normalizeToE164(parsedRaw.countryCode, parsedRaw.number);
    const parsed = parsePhoneNumber(e164, parsedRaw.countryCode);

    const email = (card.match(/^EMAIL[^:]*:(.+)$/im) || [])[1]?.trim() || "";
    const org = get("ORG").split(";")[0];
    const title = get("TITLE");
    const note = get("NOTE");
    const bday = get("BDAY");

    const contact: Contact = {
      id: generateClientEntityId("vcard", "_"),
      name,
      firstName,
      lastName,
      phones: phone
        ? [{ label: mobileLabel, countryCode: parsed.countryCode, number: parsed.number }]
        : [],
      emails: email ? [{ label: personalLabel, address: email }] : [],
      employer: org || "",
      designation: title || "",
      notes: note || "",
      addresses: [],
      socials: [],
      relationshipContacts: [],
      createdAt: todayISO(),
    };

    if (bday) {
      const clean = bday.replace(/[^0-9]/g, "");
      if (clean.length === 8) {
        contact.dob = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
      }
    }

    contacts.push(contact);
  }

  return contacts;
}

/**
 * Escapes a value for use in a vCard 3.0 text field: backslash, newlines, and
 * the `;`/`,` component separators. Without this a value containing
 * `\r\nEND:VCARD\r\nBEGIN:VCARD…` injects forged cards.
 */
function escapeVCardText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value : String(value);
  if (!raw) return "";
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** Restricts a `TYPE=` token to safe characters. */
function sanitizeVCardType(label: unknown, fallback: string): string {
  const raw = typeof label === "string" ? label : "";
  const token = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return token || fallback;
}

/**
 * Converts a Contact object into a standard vCard 3.0 (.vcf) formatted string.
 *
 * @param contact - The contact object to convert.
 * @returns The formatted vCard string.
 */
export function toVCard(contact: Contact): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCardText(contact.name)}`,
    `N:${escapeVCardText(contact.lastName)};${escapeVCardText(contact.firstName)};;;`,
  ];

  (contact.phones || []).forEach((phoneEntry) =>
    lines.push(
      `TEL;TYPE=${sanitizeVCardType(phoneEntry.label, "CELL")}:${escapeVCardText(phoneEntry.number)}`,
    ),
  );
  (contact.emails || []).forEach((emailEntry) =>
    lines.push(
      `EMAIL;TYPE=${sanitizeVCardType(emailEntry.label, "INTERNET")}:${escapeVCardText(emailEntry.address)}`,
    ),
  );
  if (contact.employer) lines.push(`ORG:${escapeVCardText(contact.employer)}`);
  if (contact.designation) lines.push(`TITLE:${escapeVCardText(contact.designation)}`);
  if (contact.notes) lines.push(`NOTE:${escapeVCardText(contact.notes)}`);
  if (contact.dob) lines.push(`BDAY:${contact.dob.replace(/-/g, "")}`);

  lines.push("END:VCARD");
  return lines.join("\r\n");
}
