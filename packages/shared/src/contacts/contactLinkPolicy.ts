/**
 * Contact-first person policy: identity fields live on `contacts` only.
 * Module records store `contactId` (or chain via studentId / facultyId) and hydrate display fields on read.
 */

/** Profile fields owned by the contacts collection — never persist on linked module rows. */
export const CONTACT_PROFILE_FIELDS = [
  "name",
  "phone",
  "email",
  "gender",
  "dob",
  "city",
  "firstName",
  "lastName",
] as const;

export interface ContactLike {
  id?: string | number | null;
  name?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dob?: string;
  avatar?: string | null;
  email?: string;
  phone?: string;
  city?: string;
  phones?: { number?: string; isPrimary?: boolean }[];
  emails?: { address?: string; isPrimary?: boolean }[];
  addresses?: {
    city?: string;
    state?: string;
    country?: string;
    line1?: string;
    isPrimary?: boolean;
  }[];
  education?: Array<{ degree?: string; fieldOfStudy?: string; institution?: string }>;
  skills?: Array<{ name?: string }>;
  qualification?: string;
  specialization?: string;
  [key: string]: unknown;
}

function nonEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Composes a display name from first/last name parts (trims and drops empties). */
export function composeContactName(firstName?: string, lastName?: string): string {
  return [firstName, lastName].map(nonEmpty).filter(Boolean).join(" ");
}

/** Display name from contact profile fields (composed when `name` is empty). */
export function contactDisplayName(contact: ContactLike): string {
  return nonEmpty(contact.name) || composeContactName(contact.firstName, contact.lastName);
}

export function stripRecordFields<T extends Record<string, unknown>>(
  record: T,
  fields: readonly string[],
): T {
  const strippedRecord = { ...record };
  for (const field of fields) {
    delete strippedRecord[field];
  }
  return strippedRecord;
}

/** Removes contact-owned profile fields when a contact link is present. */
export function normalizeContactLinkedRecord<T extends Record<string, unknown>>(
  record: T,
  contactIdField = "contactId",
): T {
  const contactId = record[contactIdField];
  if (contactId == null || contactId === "") return record;
  return stripRecordFields(record, CONTACT_PROFILE_FIELDS);
}

/** Removes parent name copies when parent contact links exist. */
export function normalizeParentContactLinks<T extends Record<string, unknown>>(record: T): T {
  let normalizedRecord = { ...record };
  if (normalizedRecord.fatherContactId != null && normalizedRecord.fatherContactId !== "") {
    normalizedRecord = stripRecordFields(normalizedRecord, ["fatherName"]);
  }
  if (normalizedRecord.motherContactId != null && normalizedRecord.motherContactId !== "") {
    normalizedRecord = stripRecordFields(normalizedRecord, ["motherName"]);
  }
  if (normalizedRecord.guardianContactId != null && normalizedRecord.guardianContactId !== "") {
    normalizedRecord = stripRecordFields(normalizedRecord, ["guardianName"]);
  }
  return normalizedRecord;
}

/** Removes a denormalized display name when the canonical id field is set. */
export function normalizeIdLinkedName<T extends Record<string, unknown>>(
  record: T,
  idField: string,
  nameField: string,
): T {
  const id = record[idField];
  if (id == null || id === "") return record;
  return stripRecordFields(record, [nameField]);
}

export function lookupContact(
  contacts: ContactLike[] | Map<string, ContactLike>,
  contactId: unknown,
): ContactLike | undefined {
  if (contactId == null || contactId === "") return undefined;
  const strId = String(contactId);
  if (contacts instanceof Map) {
    return contacts.get(strId);
  }
  return contacts.find((c) => c?.id != null && String(c.id) === strId);
}

/** Pre-indexes a contact collection into an O(1) lookup map for batch hydration. */
export function createContactLookupMap<C extends ContactLike>(contacts: C[]): Map<string, C> {
  const map = new Map<string, C>();
  for (const c of contacts) {
    if (c?.id != null) map.set(String(c.id), c);
  }
  return map;
}

export function hydrateContactProfile<T extends Record<string, unknown>>(
  record: T,
  contacts: ContactLike[] | Map<string, ContactLike>,
  contactIdField = "contactId",
): T {
  const contactId = record[contactIdField];
  if (contactId == null || contactId === "") return record;
  const contact = lookupContact(contacts, contactId);
  if (!contact) return record;
  const contactName = contactDisplayName(contact);
  // Prefer collections; fall back to scalar mirrors for legacy/test fixtures.
  const contactEmail = nonEmpty(contact.emails?.[0]?.address) || nonEmpty(contact.email);
  const contactPhone = nonEmpty(contact.phones?.[0]?.number) || nonEmpty(contact.phone);
  const contactCity =
    nonEmpty(contact.addresses?.[0]?.city as string | undefined) || nonEmpty(contact.city);
  return {
    ...record,
    // Prefer non-empty contact values — `??` would keep "" and wipe stored auth names.
    name: contactName || record.name,
    gender: nonEmpty(contact.gender) || record.gender,
    dob: nonEmpty(contact.dob) || record.dob,
    phone: contactPhone || record.phone,
    email: contactEmail || record.email,
    city: contactCity || record.city,
  };
}

export function hydrateParentContactNames<T extends Record<string, unknown>>(
  record: T,
  contacts: ContactLike[] | Map<string, ContactLike>,
): T {
  let hydratedRecord = { ...record };
  if (record.fatherContactId != null && record.fatherContactId !== "") {
    const contact = lookupContact(contacts, record.fatherContactId);
    if (contact?.name) hydratedRecord = { ...hydratedRecord, fatherName: contact.name };
  }
  if (record.motherContactId != null && record.motherContactId !== "") {
    const contact = lookupContact(contacts, record.motherContactId);
    if (contact?.name) hydratedRecord = { ...hydratedRecord, motherName: contact.name };
  }
  if (record.guardianContactId != null && record.guardianContactId !== "") {
    const contact = lookupContact(contacts, record.guardianContactId);
    if (contact?.name) hydratedRecord = { ...hydratedRecord, guardianName: contact.name };
  }
  return hydratedRecord;
}

export interface NamedEntity {
  id: string | number;
  name?: string;
}

export function resolveEntityName(
  id: string | number | null | undefined,
  entities: NamedEntity[] | Map<string, NamedEntity>,
): string {
  if (id == null || id === "") return "";
  const strId = String(id);
  if (entities instanceof Map) {
    return entities.get(strId)?.name ?? "";
  }
  return entities.find((entity) => String(entity.id) === strId)?.name ?? "";
}

/** Pre-indexes a named entity collection into an O(1) lookup map for batch resolution. */
export function createNamedEntityLookupMap<E extends NamedEntity>(entities: E[]): Map<string, E> {
  const map = new Map<string, E>();
  for (const e of entities) {
    if (e?.id != null) map.set(String(e.id), e);
  }
  return map;
}
