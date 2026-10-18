import type { Contact, FieldDefinition, TabDefinition } from "./contactTypes.js";
import { canViewContactField, canViewContactTab } from "./contactFieldAccess.js";

export interface ContactFieldConfigSnapshot {
  fields: Record<string, FieldDefinition[]>;
  tabs: TabDefinition[];
}

const TAB_COLLECTION_KEYS: Record<string, (keyof Contact)[]> = {
  phones: ["phones", "phone"],
  emails: ["emails", "email"],
  addresses: ["addresses", "city", "state", "country"],
  socials: ["socials"],
  relationship: ["relationshipContacts"],
  relationships: ["relationships"],
};

function fieldVisible(viewerRole: string, field: FieldDefinition | undefined): boolean {
  if (!field) return true;
  if (!field.enabled) return false;
  return canViewContactField(viewerRole, field);
}

/**
 * Resolves contact field keys that the viewer role cannot read.
 * Precomputed once per batch to avoid O(N * T * F) iterations and repeated tab/field finds.
 */
export function resolveContactKeysToStripForViewer(
  viewerRole: string,
  config: ContactFieldConfigSnapshot,
): string[] {
  const { fields, tabs = [] } = config;
  const tabMap = new Map<string, TabDefinition>();
  for (const t of tabs) {
    if (t.key) {
      tabMap.set(t.key.toLowerCase(), t);
    }
  }

  const toStrip = new Set<string>();

  const fieldLookup = new Map<string, FieldDefinition>();
  for (const [tabId, tabFields] of Object.entries(fields || {})) {
    const tabKey = tabId.toLowerCase();
    for (const field of tabFields || []) {
      fieldLookup.set(`${tabKey}:${field.key}`, field);
    }
  }

  for (const [tabId, keys] of Object.entries(TAB_COLLECTION_KEYS)) {
    const tab = tabMap.get(tabId.toLowerCase());
    const tabDef = tab ?? { key: tabId, label: tabId, enabled: true, order: 0 };
    const isEnabled = tab ? tab.enabled !== false : true;
    if (!isEnabled || !canViewContactTab(viewerRole, tabDef)) {
      for (const key of keys) {
        toStrip.add(String(key));
      }
      continue;
    }
    if (
      tabId === "phones" &&
      fields.phones?.length &&
      !fieldVisible(viewerRole, fieldLookup.get("phones:number"))
    ) {
      toStrip.add("phones");
      toStrip.add("phone");
    }
    if (
      tabId === "emails" &&
      fields.emails?.length &&
      !fieldVisible(viewerRole, fieldLookup.get("emails:address"))
    ) {
      toStrip.add("emails");
      toStrip.add("email");
    }
  }

  for (const [tabId, tabFields] of Object.entries(fields)) {
    if (TAB_COLLECTION_KEYS[tabId]) continue;
    const tab = tabMap.get(tabId.toLowerCase());
    const isEnabled = tab ? tab.enabled !== false : true;
    if (!isEnabled) {
      for (const field of tabFields) {
        toStrip.add(field.key);
      }
      continue;
    }
    for (const field of tabFields) {
      if (!fieldVisible(viewerRole, field)) {
        toStrip.add(field.key);
      }
    }
  }

  if (!fieldVisible(viewerRole, fieldLookup.get("basic:firstName"))) {
    toStrip.add("firstName");
    toStrip.add("name");
  }
  if (!fieldVisible(viewerRole, fieldLookup.get("basic:lastName"))) {
    toStrip.add("lastName");
  }

  return Array.from(toStrip);
}

/** Strips contact properties the viewer role cannot read (API + export guard). */
export function sanitizeContactForViewer(
  contact: Contact,
  viewerRole: string,
  config: ContactFieldConfigSnapshot,
): Contact {
  const keysToStrip = resolveContactKeysToStripForViewer(viewerRole, config);
  if (keysToStrip.length === 0) return contact;
  const sanitizedContact: Contact = { ...contact };
  for (const key of keysToStrip) {
    delete sanitizedContact[key as keyof Contact];
  }
  return sanitizedContact;
}

export function sanitizeContactsForViewer(
  contacts: Contact[],
  viewerRole: string,
  config: ContactFieldConfigSnapshot,
): Contact[] {
  const keysToStrip = resolveContactKeysToStripForViewer(viewerRole, config);
  if (keysToStrip.length === 0) return contacts;
  return contacts.map((contact) => {
    const sanitizedContact: Contact = { ...contact };
    for (const key of keysToStrip) {
      delete sanitizedContact[key as keyof Contact];
    }
    return sanitizedContact;
  });
}

/** Summarises changed top-level keys for audit (globle1 §1.3). */
export function summarizeContactFieldChanges(before: Contact, after: Contact): string {
  const skip = new Set(["updatedAt", "activities"]);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (skip.has(key)) continue;
    const a = before[key as keyof Contact];
    const b = after[key as keyof Contact];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changed.push(key);
    }
  }
  if (changed.length === 0) return "Updated contact (no field diff)";
  const preview = changed.slice(0, 8).join(", ");
  return changed.length > 8
    ? `Changed: ${preview}, +${changed.length - 8} more`
    : `Changed: ${preview}`;
}
