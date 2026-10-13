/** Contact draft cleaning — strips blank rows from built-in and custom collections. */
import type { Contact } from "./contactTypes.js";
import { isContactCustomCollectionTab } from "./contactEnabledTabs.js";
import { stripContactClientSoftDeleteFields } from "./contactSoftDelete.js";
import { hydrateContactRelationshipFields } from "./contactRelationshipHydrate.js";
import { formatCnic } from "../core/identityFormatUtils.js";
import { getContactTags } from "./contactEntityTypes.js";
import {
  PHONE_SYSTEM_KEYS,
  EMAIL_SYSTEM_KEYS,
  ADDRESS_SYSTEM_KEYS,
  SOCIAL_SYSTEM_KEYS,
  EDUCATION_SYSTEM_KEYS,
  EXPERIENCE_SYSTEM_KEYS,
  SKILL_SYSTEM_KEYS,
  RELATIONSHIP_SYSTEM_KEYS,
  BANK_DETAIL_SYSTEM_KEYS,
} from "./contactItemNormalizeKeys.js";

const CONTACT_ENTITY_ARRAY_KEYS = new Set([
  "phones",
  "emails",
  "addresses",
  "socials",
  "education",
  "experience",
  "skills",
  "bankDetails",
  "relationshipContacts",
  "relationships",
  "activities",
  "attachments",
  "emergencyContacts",
  "tags",
]);

function valueHasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function isBlankContactListRow(
  row: unknown,
  requiredContentKeys: readonly string[],
  systemKeys: ReadonlySet<string>,
): boolean {
  if (!row || typeof row !== "object" || Array.isArray(row)) return true;
  const obj = row as Record<string, unknown>;
  if (requiredContentKeys.some((k) => valueHasContent(obj[k]))) return false;
  for (const [k, v] of Object.entries(obj)) {
    if (systemKeys.has(k)) continue;
    if (valueHasContent(v)) return false;
  }
  return true;
}

function isBlankCustomCollectionRow(row: unknown): boolean {
  if (!row || typeof row !== "object" || Array.isArray(row)) return true;
  return Object.values(row as Record<string, unknown>).every((val) => !valueHasContent(val));
}

/** Ensures exactly one `isPrimary` flag among list items (first when none set). */
export function ensureSinglePrimaryFlag<T extends { isPrimary?: boolean }>(items: T[]): T[] {
  if (items.length === 0) return items;
  const primaryIdx = items.findIndex((i) => i.isPrimary);
  const keepIndex = primaryIdx >= 0 ? primaryIdx : 0;
  return items.map((item, index) => ({ ...item, isPrimary: index === keepIndex }));
}

/** Strips blank phones, emails, addresses, socials, relationship contacts, and custom-tab rows. */
export function cleanContactDraft(draft: Partial<Contact>): Partial<Contact> {
  const result = hydrateContactRelationshipFields(
    stripContactClientSoftDeleteFields({ ...draft } as Record<string, unknown>) as Partial<Contact>,
  );

  if (typeof result.cnic === "string") {
    const trimmed = result.cnic.trim();
    result.cnic = trimmed ? formatCnic(trimmed) : "";
  }
  if (typeof (result as Record<string, unknown>).email === "string") {
    (result as Record<string, unknown>).email = String((result as Record<string, unknown>).email)
      .trim()
      .toLowerCase();
  }

  if (result.tags !== undefined || result.tag !== undefined) {
    result.tags = getContactTags(result);
    delete (result as Record<string, unknown>).tag;
  }

  if (Array.isArray(result.phones)) {
    result.phones = ensureSinglePrimaryFlag(
      result.phones
        .filter((phone) => !isBlankContactListRow(phone, ["number"], PHONE_SYSTEM_KEYS))
        .map((phone) => ({
          ...phone,
          number: (phone.number || "").trim(),
          countryCode:
            typeof phone.countryCode === "string" ? phone.countryCode.trim() : phone.countryCode,
        })),
    );
  }
  if (Array.isArray(result.emails)) {
    result.emails = ensureSinglePrimaryFlag(
      result.emails
        .filter((email) => !isBlankContactListRow(email, ["address"], EMAIL_SYSTEM_KEYS))
        .map((email) => ({ ...email, address: (email.address || "").trim().toLowerCase() })),
    );
  }
  if (Array.isArray(result.addresses)) {
    result.addresses = ensureSinglePrimaryFlag(
      result.addresses.filter(
        (a) =>
          !isBlankContactListRow(a, ["line1", "city", "state", "country"], ADDRESS_SYSTEM_KEYS),
      ),
    );
  }
  if (Array.isArray(result.socials)) {
    result.socials = result.socials.filter(
      (s) => !isBlankContactListRow(s, ["url"], SOCIAL_SYSTEM_KEYS),
    );
  }
  if (Array.isArray(result.education)) {
    result.education = result.education.filter(
      (edu) =>
        !isBlankContactListRow(
          edu,
          ["institution", "degree", "fieldOfStudy"],
          EDUCATION_SYSTEM_KEYS,
        ),
    );
  }
  if (Array.isArray(result.experience)) {
    result.experience = result.experience.filter(
      (exp) => !isBlankContactListRow(exp, ["title", "organization"], EXPERIENCE_SYSTEM_KEYS),
    );
  }
  if (Array.isArray(result.skills)) {
    result.skills = result.skills.filter(
      (sk) => !isBlankContactListRow(sk, ["name"], SKILL_SYSTEM_KEYS),
    );
  }
  if (Array.isArray(result.bankDetails)) {
    result.bankDetails = result.bankDetails
      .filter(
        (b) =>
          !isBlankContactListRow(
            b,
            ["bankName", "accountTitle", "accountNumber"],
            BANK_DETAIL_SYSTEM_KEYS,
          ),
      )
      .map((b) => ({
        ...b,
        bankName: typeof b.bankName === "string" ? b.bankName.trim() : (b.bankName ?? ""),
        accountTitle:
          typeof b.accountTitle === "string"
            ? b.accountTitle.trim()
            : (((b as Record<string, unknown>).title as string) ?? ""),
        accountNumber:
          typeof b.accountNumber === "string"
            ? b.accountNumber.trim()
            : (((b as Record<string, unknown>).iban as string) ?? b.accountNumber ?? ""),
      }));
  }
  if (Array.isArray(result.relationshipContacts)) {
    result.relationshipContacts = result.relationshipContacts
      .filter(
        (link) => !isBlankContactListRow(link, ["contactId", "name"], RELATIONSHIP_SYSTEM_KEYS),
      )
      .map((link) => ({
        ...link,
        contactId:
          link.contactId !== undefined && link.contactId !== null && String(link.contactId).trim()
            ? String(link.contactId).trim()
            : undefined,
        relationship:
          typeof link.relationship === "string" ? link.relationship.trim() : link.relationship,
      }));
    if (result.relationshipContacts.length === 0) result.relationships = [];
  }

  for (const key of Object.keys(result)) {
    if (CONTACT_ENTITY_ARRAY_KEYS.has(key) || !isContactCustomCollectionTab(key)) continue;
    const rows = result[key];
    if (Array.isArray(rows)) result[key] = rows.filter((r) => !isBlankCustomCollectionRow(r));
  }

  return result;
}

export * from "./contactItemNormalizeRows.js";
export * from "./contactItemNormalizeBankRows.js";
