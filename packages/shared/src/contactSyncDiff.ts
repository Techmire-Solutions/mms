import type { Contact } from "./contactTypes.js";
import { getPrimaryEmail } from "./contactDisplayUtils.js";
import { getPrimaryPhone } from "./phoneUtils.js";

export interface ContactFieldDiff {
  field: string;
  local: string;
  server: string;
}

const SYNC_DIFF_FIELDS = [
  "name",
  "firstName",
  "lastName",
  "gender",
  "phone",
  "email",
  "city",
] as const;

export type ContactSyncDiffField = (typeof SYNC_DIFF_FIELDS)[number];

/** i18n keys for sync conflict field labels (`contacts.reportFields.*`). */
export const CONTACT_SYNC_FIELD_LABEL_KEYS: Record<ContactSyncDiffField, string> = {
  name: "contacts.reportFields.fullName",
  firstName: "contacts.reportFields.firstName",
  lastName: "contacts.reportFields.lastName",
  gender: "contacts.reportFields.gender",
  phone: "contacts.reportFields.phone",
  email: "contacts.reportFields.email",
  city: "contacts.reportFields.city",
};

function snapshotValue(contact: Contact, field: (typeof SYNC_DIFF_FIELDS)[number]): string {
  switch (field) {
    case "phone":
      return getPrimaryPhone(contact) || "—";
    case "email":
      return getPrimaryEmail(contact) || "—";
    case "city":
      return contact.addresses?.[0]?.city || "—";
    default: {
      const fieldValue = contact[field as keyof Contact];
      if (fieldValue === undefined || fieldValue === null || fieldValue === "") return "—";
      return String(fieldValue);
    }
  }
}

/** Field-level diff for offline sync conflict review (globle1 §1.4). */
export function diffContactForSync(
  local: Contact,
  server: Contact | undefined,
): ContactFieldDiff[] {
  if (!server) {
    return SYNC_DIFF_FIELDS.map((field) => ({
      field,
      local: snapshotValue(local, field),
      server: "—",
    }));
  }
  const diffs: ContactFieldDiff[] = [];
  for (const field of SYNC_DIFF_FIELDS) {
    const a = snapshotValue(local, field);
    const b = snapshotValue(server, field);
    if (a !== b) {
      diffs.push({ field, local: a, server: b });
    }
  }
  return diffs;
}

export function resolveSyncConflictContactId(entry: {
  kind: string;
  contactId?: string;
  contact?: Contact;
}): string | undefined {
  if (entry.kind === "update" || entry.kind === "delete") {
    return entry.contactId ? String(entry.contactId) : undefined;
  }
  if (entry.contact?.id != null) return String(entry.contact.id);
  return undefined;
}

export type SyncFieldPick = "local" | "server";

function applySyncFieldValue(
  target: Contact,
  source: Contact,
  field: (typeof SYNC_DIFF_FIELDS)[number],
): void {
  switch (field) {
    case "phone":
      if (Array.isArray(source.phones)) {
        target.phones = [...source.phones];
        target.phone = getPrimaryPhone({ phones: source.phones }) || "";
      } else if (source.phone) {
        target.phone = source.phone;
      }
      break;
    case "email":
      if (Array.isArray(source.emails)) {
        target.emails = [...source.emails];
        target.email = getPrimaryEmail({ emails: source.emails }) || "";
      } else if (source.email) {
        target.email = source.email;
      }
      break;
    case "city":
      if (Array.isArray(source.addresses)) {
        const first = source.addresses[0];
        target.addresses = [...source.addresses];
        target.city = first?.city || "";
        target.line1 = first?.line1 || "";
        target.state = first?.state || "";
        target.country = first?.country || "";
        target.address = first?.line1 || "";
      } else if (source.city) {
        target.city = source.city;
      }
      break;
    default: {
      const fieldValue = source[field as keyof Contact];
      if (fieldValue !== undefined) (target as Record<string, unknown>)[field] = fieldValue;
    }
  }
}

/** Merge local pending change with server record using per-field picks (globle1 §1.4). */
export function mergeContactForSync(
  local: Contact,
  server: Contact | undefined,
  fieldPicks: Partial<Record<string, SyncFieldPick>> = {},
  defaultPick: SyncFieldPick = "local",
): Contact {
  const base: Contact = server ? { ...server } : { ...local };
  if (local.id != null) base.id = local.id;

  for (const field of SYNC_DIFF_FIELDS) {
    const pick = fieldPicks[field] ?? defaultPick;
    const source = pick === "local" ? local : server;
    if (source) applySyncFieldValue(base, source, field);
  }

  if (local.name) base.name = local.name;
  else if (base.firstName || base.lastName) {
    base.name = [base.firstName, base.lastName].filter(Boolean).join(" ").trim();
  }

  return base;
}

export function defaultSyncFieldPicks(diffs: ContactFieldDiff[]): Record<string, SyncFieldPick> {
  const picks: Record<string, SyncFieldPick> = {};
  for (const diff of diffs) picks[diff.field] = "local";
  return picks;
}
