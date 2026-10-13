import { INITIAL_FIELD_SEED, type FieldDefinition } from "./contactTypes.js";
import { canViewContactField } from "./contactFieldAccess.js";
import {
  isRelationshipContactColumnKey,
  isRelationshipTypeColumnKey,
  resolveRelationshipFieldsTabId,
} from "./contactEmergencyTabMigration.js";

export interface ContactColumnFieldContext {
  fields: Record<string, FieldDefinition[]>;
  enabledTabIds: ReadonlySet<string>;
  isTabFieldEnabled: (tabId: string, fieldId: string) => boolean;
}

function findField(
  fields: Record<string, FieldDefinition[]>,
  tabId: string,
  fieldId: string,
): FieldDefinition | null {
  const fromFields = (fields[tabId] || []).find((field) => field.key === fieldId);
  if (fromFields) return fromFields;
  const seedField = (INITIAL_FIELD_SEED[tabId] || []).find((field) => field.key === fieldId);
  return seedField ?? null;
}

/** Maps a Work table column key to its governing field definition (if any). */
export function resolveContactColumnField(
  columnKey: string,
  columnFieldContext: ContactColumnFieldContext,
): FieldDefinition | null {
  const { fields, enabledTabIds, isTabFieldEnabled } = columnFieldContext;

  if (columnKey === "name") {
    return isTabFieldEnabled("basic", "firstName") ? findField(fields, "basic", "firstName") : null;
  }
  if (columnKey === "phone") {
    return enabledTabIds.has("phones") && isTabFieldEnabled("phones", "number")
      ? findField(fields, "phones", "number")
      : null;
  }
  if (columnKey === "whatsapp") {
    return enabledTabIds.has("phones") && isTabFieldEnabled("phones", "whatsapp")
      ? findField(fields, "phones", "whatsapp")
      : null;
  }
  if (columnKey === "email") {
    return enabledTabIds.has("emails") && isTabFieldEnabled("emails", "address")
      ? findField(fields, "emails", "address")
      : null;
  }
  if (columnKey === "city") {
    return enabledTabIds.has("addresses") && isTabFieldEnabled("addresses", "city")
      ? findField(fields, "addresses", "city")
      : null;
  }
  if (columnKey === "state") {
    return enabledTabIds.has("addresses") && isTabFieldEnabled("addresses", "state")
      ? findField(fields, "addresses", "state")
      : null;
  }
  if (columnKey === "country") {
    return enabledTabIds.has("addresses") && isTabFieldEnabled("addresses", "country")
      ? findField(fields, "addresses", "country")
      : null;
  }
  if (columnKey === "line1") {
    return enabledTabIds.has("addresses") && isTabFieldEnabled("addresses", "line1")
      ? findField(fields, "addresses", "line1")
      : null;
  }
  if (columnKey === "gender") {
    return isTabFieldEnabled("basic", "gender") ? findField(fields, "basic", "gender") : null;
  }
  if (columnKey === "dob") {
    return isTabFieldEnabled("basic", "dob") ? findField(fields, "basic", "dob") : null;
  }
  if (columnKey === "isSyed") {
    return isTabFieldEnabled("basic", "isSyed") ? findField(fields, "basic", "isSyed") : null;
  }
  if (columnKey === "socials_platform") {
    return enabledTabIds.has("socials") && isTabFieldEnabled("socials", "platform")
      ? findField(fields, "socials", "platform")
      : null;
  }
  if (columnKey === "socials_url") {
    return enabledTabIds.has("socials") && isTabFieldEnabled("socials", "url")
      ? findField(fields, "socials", "url")
      : null;
  }
  if (isRelationshipContactColumnKey(columnKey)) {
    const tabId = resolveRelationshipFieldsTabId(fields, enabledTabIds);
    return tabId && isTabFieldEnabled(tabId, "contactId")
      ? findField(fields, tabId, "contactId")
      : null;
  }
  if (isRelationshipTypeColumnKey(columnKey)) {
    const tabId = resolveRelationshipFieldsTabId(fields, enabledTabIds);
    return tabId && isTabFieldEnabled(tabId, "relationship")
      ? findField(fields, tabId, "relationship")
      : null;
  }

  for (const [tabId, tabFields] of Object.entries(fields)) {
    const tabEnabled = tabId === "basic" || enabledTabIds.has(tabId);
    if (!tabEnabled) continue;
    const field = tabFields.find((tabField) => tabField.key === columnKey);
    if (field) return field;
  }
  return null;
}

/** Whether the current viewer may see a Work table column (registry + field permissions). */
export function canViewContactColumn(
  viewerRole: string,
  columnKey: string,
  columnFieldContext: ContactColumnFieldContext,
): boolean {
  const field = resolveContactColumnField(columnKey, columnFieldContext);
  if (!field) return true;
  if (!field.enabled) return false;
  return canViewContactField(viewerRole, field);
}
