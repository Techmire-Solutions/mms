import type { Contact, FieldDefinition, TabDefinition } from "./contactTypes.js";
import { INITIAL_FIELD_SEED } from "./contactTypes.js";
import { canViewContactField, canViewContactTab } from "./contactFieldAccess.js";
import { normalizeContactReportFieldId } from "./contactEmergencyTabMigration.js";
import { getPrimaryEmail, getPrimaryPhone } from "./utils.js";

const CONTACTS_REPORT_FIELD_IDS = [
  "fullName",
  "firstName",
  "lastName",
  "gender",
  "dob",
  "isSyed",
  "phone",
  "email",
  "streetAddress",
  "city",
  "state",
  "country",
  "relationshipContact",
  "lastActivity",
  "notesCount",
] as const;

type ContactsReportFieldId = (typeof CONTACTS_REPORT_FIELD_IDS)[number] | string;

interface ContactsReportFieldDef {
  id: ContactsReportFieldId;
  labelKey: string;
}

const CONTACTS_REPORT_FIELDS: ContactsReportFieldDef[] = CONTACTS_REPORT_FIELD_IDS.map((id) => ({
  id,
  labelKey: `contacts.reportFields.${id}`,
}));

const REPORT_FIELD_ID_SET = new Set<string>(CONTACTS_REPORT_FIELD_IDS);
const CONTACTS_REPORT_FIELDS_BY_ID = new Map(CONTACTS_REPORT_FIELDS.map((d) => [d.id, d]));

const CUSTOM_CONTACT_REPORT_FIELD_PREFIX = "custom:";

const PREDEFINED_FIELD_KEYS = new Set(
  Object.values(INITIAL_FIELD_SEED).flatMap((fields) => fields.map((f) => f.key)),
);

export function isContactsReportFieldId(value: string): value is ContactsReportFieldId {
  return REPORT_FIELD_ID_SET.has(value) || isCustomContactReportFieldId(value);
}

function isCustomContactReportFieldId(value: string): boolean {
  return value.startsWith(CUSTOM_CONTACT_REPORT_FIELD_PREFIX);
}

function customContactReportFieldKey(fieldId: string): string {
  return fieldId.slice(CUSTOM_CONTACT_REPORT_FIELD_PREFIX.length);
}

/** Merges registry custom fields into the contacts report builder catalog (§4.1). */
export function buildContactsReportFieldCatalog(
  fields: Record<string, FieldDefinition[]>,
  tabs: TabDefinition[],
  viewerRole: string,
): ContactsReportFieldDef[] {
  const builtInIds = new Set(CONTACTS_REPORT_FIELDS.map((f) => f.id));
  const custom: ContactsReportFieldDef[] = [];
  const customIds = new Set<string>();

  for (const tab of tabs) {
    if (!tab.enabled || !canViewContactTab(viewerRole, tab)) continue;
    const tabFields = fields[tab.key] ?? [];
    for (const field of tabFields) {
      if (!field.enabled || !canViewContactField(viewerRole, field)) continue;
      if (PREDEFINED_FIELD_KEYS.has(field.key) && builtInIds.has(field.key)) continue;
      if (PREDEFINED_FIELD_KEYS.has(field.key)) continue;
      const id = `${CUSTOM_CONTACT_REPORT_FIELD_PREFIX}${field.key}`;
      if (customIds.has(id)) continue;
      customIds.add(id);
      custom.push({ id, labelKey: `contacts.reportFields.custom.${field.key}` });
    }
  }

  return [...CONTACTS_REPORT_FIELDS, ...custom];
}

export function resolveContactReportFieldLabel(
  fieldId: string,
  fields: Record<string, FieldDefinition[]>,
  t: (key: string) => string,
): string {
  if (REPORT_FIELD_ID_SET.has(fieldId)) {
    const def = CONTACTS_REPORT_FIELDS_BY_ID.get(fieldId);
    return def ? t(def.labelKey) : fieldId;
  }
  if (isCustomContactReportFieldId(fieldId)) {
    const key = customContactReportFieldKey(fieldId);
    for (const tabKey in fields) {
      const tabFields = fields[tabKey];
      if (!tabFields) continue;
      for (let i = 0; i < tabFields.length; i++) {
        if (tabFields[i].key === key) return tabFields[i].label;
      }
    }
    return key;
  }
  return fieldId;
}

export interface ContactReportCellLabels {
  yes: string;
  no: string;
}

/**
 * Compiles a high-performance cell extractor for a given report field ID.
 * Avoids per-cell normalization and string slicing.
 */
export function compileContactReportCellExtractor(
  fieldId: string,
  labels: ContactReportCellLabels,
): (item: Record<string, unknown>) => string | number {
  if (isCustomContactReportFieldId(fieldId)) {
    const key = customContactReportFieldKey(fieldId);
    return (item) => {
      const contact = item as Contact;
      const value = contact[key];
      if (value === undefined || value === null || value === "") return "—";
      if (typeof value === "boolean") return value ? labels.yes : labels.no;
      return String(value);
    };
  }

  const normalized = normalizeContactReportFieldId(fieldId);
  switch (normalized) {
    case "fullName":
      return (item) => {
        const contact = item as Contact;
        return (
          String(contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`).trim() ||
          "—"
        );
      };
    case "firstName":
      return (item) => String((item as Contact).firstName || "—");
    case "lastName":
      return (item) => String((item as Contact).lastName || "—");
    case "isSyed":
      return (item) => ((item as Contact).isSyed ? labels.yes : labels.no);
    case "phone":
      return (item) => getPrimaryPhone(item as Contact) || "—";
    case "email":
      return (item) => getPrimaryEmail(item as Contact) || "—";
    case "streetAddress":
      return (item) => (item as Contact).addresses?.[0]?.line1 || "—";
    case "city":
      return (item) => (item as Contact).addresses?.[0]?.city || "—";
    case "state":
      return (item) => (item as Contact).addresses?.[0]?.state || "—";
    case "country":
      return (item) => (item as Contact).addresses?.[0]?.country || "—";
    case "relationshipContact":
      return (item) => {
        const linked = (item as Contact).relationshipContacts;
        return linked?.[0]?.name || linked?.[0]?.contactId || "—";
      };
    case "lastActivity":
      return (item) => (item as Contact).activities?.[0]?.date || "—";
    case "notesCount":
      return (item) => {
        const activities = (item as Contact).activities;
        if (!activities || activities.length === 0) return 0;
        let count = 0;
        for (let i = 0; i < activities.length; i++) {
          if (activities[i]?.type === "note") count++;
        }
        return count;
      };
    default:
      return (item) => {
        const value = (item as Contact)[fieldId as keyof Contact];
        if (value === undefined || value === null) return "—";
        return String(value);
      };
  }
}

/** Resolves a contact report cell for CustomReportBuilder preview/export. */
export function getContactReportCellValue(
  item: Record<string, unknown>,
  fieldId: string,
  labels: ContactReportCellLabels,
): string | number {
  return compileContactReportCellExtractor(fieldId, labels)(item);
}
