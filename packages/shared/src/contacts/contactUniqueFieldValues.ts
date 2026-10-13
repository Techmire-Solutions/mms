/**
 * Cross-contact uniqueness value extraction for Setup fields marked `unique: true`.
 * Pure helpers — FE/BE supply peer contacts (active only).
 */
import { normalizeSearchString } from "./contactsSearchUtils.js";
import { normalizeToE164 } from "../core/phoneUtils.js";
import type { Contact } from "./contactEntityTypes.js";
import type { FieldDefinition } from "./contactFieldSchemaTypes.js";
import { isContactCustomCollectionTab, isContactSeedFormTab } from "./contactEnabledTabs.js";

type UniqueContactFieldRef = {
  tabId: string;
  fieldKey: string;
  field: FieldDefinition;
};

/** One comparable value extracted from a contact for a unique field. */
export type UniqueContactFieldValue = {
  tabId: string;
  fieldKey: string;
  index?: number;
  normalized: string;
};

const LIST_PROP_BY_TAB: Record<string, string> = {
  phones: "phones",
  emails: "emails",
  addresses: "addresses",
  socials: "socials",
  relationship: "relationshipContacts",
};

/** Lists enabled fields with `unique: true` from a field config map. */
export function listUniqueContactFieldRefs(
  fields: Record<string, FieldDefinition[]>,
): UniqueContactFieldRef[] {
  const refs: UniqueContactFieldRef[] = [];
  for (const [tabId, tabFields] of Object.entries(fields)) {
    for (const field of tabFields) {
      if (!field.enabled || !field.unique) continue;
      refs.push({ tabId, fieldKey: field.key, field });
    }
  }
  return refs;
}

function resolveListProp(tabId: string): string | undefined {
  if (LIST_PROP_BY_TAB[tabId]) return LIST_PROP_BY_TAB[tabId];
  if (isContactCustomCollectionTab(tabId)) return tabId;
  return undefined;
}

function isListTab(tabId: string): boolean {
  return Boolean(resolveListProp(tabId));
}

/** Normalize a raw unique-field value for equality comparison. */
export function normalizeUniqueContactFieldValue(
  tabId: string,
  fieldKey: string,
  raw: unknown,
  options?: { defaultPhoneCountryCode?: string; row?: Record<string, unknown> },
): string {
  if (raw == null) return "";

  if (tabId === "phones" && fieldKey === "number") {
    const row = options?.row;
    const countryCode =
      (typeof row?.countryCode === "string" && row.countryCode) ||
      options?.defaultPhoneCountryCode ||
      "";
    const number = String(raw).trim();
    if (!number) return "";
    if (number.startsWith("+")) {
      return number.replace(/\D/g, "");
    }
    const e164 = normalizeToE164(countryCode, number);
    return e164.replace(/\D/g, "");
  }

  if (tabId === "emails" && fieldKey === "address") {
    return String(raw).trim().toLowerCase();
  }

  if (
    fieldKey === "cnic" ||
    (tabId === "basic" && fieldKey === "cnic") ||
    fieldKey.toLowerCase().includes("cnic")
  ) {
    return String(raw).replace(/\D/g, "");
  }

  if (typeof raw === "boolean") {
    return raw ? "true" : "false";
  }

  if (typeof raw === "number") {
    return Number.isFinite(raw) ? String(raw) : "";
  }

  const text = String(raw).trim();
  if (!text) return "";
  return normalizeSearchString(text);
}

function readContactRecord(contact: Partial<Contact>): Record<string, unknown> {
  return contact as Record<string, unknown>;
}

function readListRows(contact: Partial<Contact>, tabId: string): Record<string, unknown>[] {
  const prop = resolveListProp(tabId);
  if (!prop) return [];
  const value = readContactRecord(contact)[prop];
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
}

function pushScalarValue(
  out: UniqueContactFieldValue[],
  tabId: string,
  fieldKey: string,
  raw: unknown,
  options?: { defaultPhoneCountryCode?: string },
): void {
  const normalized = normalizeUniqueContactFieldValue(tabId, fieldKey, raw, options);
  if (!normalized) return;
  out.push({ tabId, fieldKey, normalized });
}

function pushListValues(
  out: UniqueContactFieldValue[],
  contact: Partial<Contact>,
  tabId: string,
  fieldKey: string,
  options?: { defaultPhoneCountryCode?: string },
): void {
  const rows = readListRows(contact, tabId);
  rows.forEach((row, index) => {
    const normalized = normalizeUniqueContactFieldValue(tabId, fieldKey, row[fieldKey], {
      ...options,
      row,
    });
    if (!normalized) return;
    out.push({ tabId, fieldKey, index, normalized });
  });

  // Legacy scalar mirrors for phones/emails.
  if (tabId === "phones" && fieldKey === "number") {
    const scalar = readContactRecord(contact).phone;
    if (typeof scalar === "string" && scalar.trim() && rows.length === 0) {
      pushScalarValue(out, tabId, fieldKey, scalar, options);
    }
  }
  if (tabId === "emails" && fieldKey === "address") {
    const scalar = readContactRecord(contact).email;
    if (typeof scalar === "string" && scalar.trim() && rows.length === 0) {
      pushScalarValue(out, tabId, fieldKey, scalar, options);
    }
  }
}

/**
 * Extracts normalized unique-field values from a contact (scalar + list tabs).
 * Empty values are omitted.
 */
export function collectUniqueContactFieldValues(
  contact: Partial<Contact>,
  uniqueFields: UniqueContactFieldRef[],
  options?: { defaultPhoneCountryCode?: string },
): UniqueContactFieldValue[] {
  const out: UniqueContactFieldValue[] = [];
  for (const { tabId, fieldKey } of uniqueFields) {
    if (isListTab(tabId)) {
      pushListValues(out, contact, tabId, fieldKey, options);
      continue;
    }
    // Seed basic / custom scalar tabs store values on the contact root.
    if (!isContactSeedFormTab(tabId) || tabId === "basic" || tabId === "custom") {
      pushScalarValue(out, tabId, fieldKey, readContactRecord(contact)[fieldKey], options);
    }
  }
  return out;
}
