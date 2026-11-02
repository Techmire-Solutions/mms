import type { Contact, FieldDefinition, TabDefinition } from "./contactTypes.js";
import { canViewContactField, canViewContactTab } from "./contactFieldAccess.js";

export interface ContactFieldConfigSnapshot {
  fields: Record<string, FieldDefinition[]>;
  tabs: TabDefinition[];
}

/**
 * Every contact property owned by a Setup tab, including the array-backed list
 * tabs. Miss an entry here and a hidden/role-restricted tab's rows are returned
 * verbatim to the viewer, so the map is deliberately exhaustive.
 */
const TAB_COLLECTION_KEYS: Record<string, readonly (keyof Contact)[]> = {
  phones: ["phones", "phone"],
  emails: ["emails", "email"],
  addresses: ["addresses", "line1", "city", "state", "country"],
  socials: ["socials"],
  relationship: ["relationshipContacts"],
  relationships: ["relationships"],
  education: ["education"],
  experience: ["experience"],
  skills: ["skills"],
  bankDetails: ["bankDetails"],
  activities: ["activities"],
  attachments: ["attachments"],
};

/** Row field whose absence makes the whole collection meaningless → drop every row. */
const TAB_IDENTITY_FIELDS: Record<string, string> = {
  phones: "number",
  emails: "address",
};

/** Top-level keys to delete plus per-collection row fields the viewer cannot read. */
interface ContactStripPlan {
  keys: string[];
  rowFields: Array<{ collection: string; fields: string[] }>;
}

/**
 * Setup tabs whose fields are top-level Contact scalars rather than row arrays.
 * Hidden fields on these tabs must be deleted from the record itself; the
 * `rowFields` path is a no-op for them (there is no `contact.basic` collection).
 */
const SCALAR_TAB_KEYS = new Set(["basic"]);

function fieldVisible(viewerRole: string, field: FieldDefinition | undefined): boolean {
  if (!field) return true;
  if (!field.enabled) return false;
  return canViewContactField(viewerRole, field);
}

function resolveContactStripPlan(
  viewerRole: string,
  config: ContactFieldConfigSnapshot,
): ContactStripPlan {
  const { fields, tabs = [] } = config;
  const tabMap = new Map<string, TabDefinition>();
  for (const t of tabs) {
    if (t.key) {
      tabMap.set(t.key.toLowerCase(), t);
    }
  }

  const toStrip = new Set<string>();
  const rowFields: ContactStripPlan["rowFields"] = [];

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
    const tabFields = fields[tabId] ?? [];
    const hiddenFields = tabFields.filter((field) => !fieldVisible(viewerRole, field));
    if (hiddenFields.length === 0) continue;
    const identityField = TAB_IDENTITY_FIELDS[tabId];
    if (identityField && hiddenFields.some((field) => field.key === identityField)) {
      for (const key of keys) {
        toStrip.add(String(key));
      }
      continue;
    }
    rowFields.push({
      collection: String(keys[0]),
      fields: hiddenFields.map((field) => field.key),
    });
  }

  // Custom (Setup-defined) tabs: the collection lives under the tab id itself.
  for (const [tabId, tabFields] of Object.entries(fields)) {
    if (TAB_COLLECTION_KEYS[tabId]) continue;
    const tab = tabMap.get(tabId.toLowerCase());
    const isEnabled = tab ? tab.enabled !== false : true;
    if (!isEnabled || (tab && !canViewContactTab(viewerRole, tab))) {
      toStrip.add(tabId);
      for (const field of tabFields) {
        toStrip.add(field.key);
      }
      continue;
    }
    const hiddenFields = tabFields.filter((field) => !fieldVisible(viewerRole, field));
    if (hiddenFields.length === 0) continue;
    if (SCALAR_TAB_KEYS.has(tabId.toLowerCase())) {
      for (const field of hiddenFields) toStrip.add(field.key);
    }
    rowFields.push({ collection: tabId, fields: hiddenFields.map((field) => field.key) });
  }

  if (!fieldVisible(viewerRole, fieldLookup.get("basic:firstName"))) {
    toStrip.add("firstName");
    toStrip.add("name");
  }
  if (!fieldVisible(viewerRole, fieldLookup.get("basic:lastName"))) {
    toStrip.add("lastName");
  }

  return { keys: Array.from(toStrip), rowFields };
}

/**
 * Resolves contact field keys that the viewer role cannot read.
 * Precomputed once per batch to avoid O(N * T * F) iterations and repeated tab/field finds.
 */
export function resolveContactKeysToStripForViewer(
  viewerRole: string,
  config: ContactFieldConfigSnapshot,
): string[] {
  return resolveContactStripPlan(viewerRole, config).keys;
}

function applyContactStripPlan(contact: Contact, plan: ContactStripPlan): Contact {
  const sanitized: Contact = { ...contact };
  const mutable = sanitized as Record<string, unknown>;
  for (const key of plan.keys) {
    delete mutable[key];
  }
  for (const { collection, fields: hiddenFields } of plan.rowFields) {
    const rows = mutable[collection];
    if (!Array.isArray(rows)) continue;
    mutable[collection] = rows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return row;
      const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
      for (const field of hiddenFields) delete copy[field];
      return copy;
    });
  }
  return sanitized;
}

/** Strips contact properties the viewer role cannot read (API + export guard). */
export function sanitizeContactForViewer(
  contact: Contact,
  viewerRole: string,
  config: ContactFieldConfigSnapshot,
): Contact {
  const plan = resolveContactStripPlan(viewerRole, config);
  if (plan.keys.length === 0 && plan.rowFields.length === 0) return contact;
  return applyContactStripPlan(contact, plan);
}

export function sanitizeContactsForViewer(
  contacts: Contact[],
  viewerRole: string,
  config: ContactFieldConfigSnapshot,
): Contact[] {
  const plan = resolveContactStripPlan(viewerRole, config);
  if (plan.keys.length === 0 && plan.rowFields.length === 0) return contacts;
  return contacts.map((contact) => applyContactStripPlan(contact, plan));
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
