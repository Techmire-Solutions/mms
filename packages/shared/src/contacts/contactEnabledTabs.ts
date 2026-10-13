import type { FieldConfig, TabDefinition } from "./contactFieldSchemaTypes.js";
import { canViewContactTab } from "./contactFieldAccess.js";
import { DEFAULT_ENABLED_TABS } from "./contactPreferenceDefaults.js";
import { CONTACT_LEGACY_CUSTOM_FORM_TAB_KEY, DEFAULT_FORM_TABS } from "./contactTabRegistry.js";

/** Form tabs Setup cannot disable; the form always treats them as on. */
export const CONTACT_LOCKED_ENABLED_TABS = ["basic"] as const;

/**
 * Field keys Setup cannot disable or un-require (write schema always needs firstName).
 * Tab id → locked field keys.
 */
export const CONTACT_LOCKED_FIELD_KEYS: Readonly<Record<string, readonly string[]>> = {
  basic: ["firstName"],
};

/** True when `tabKey` is a locked always-on Contacts form tab. */
export function isContactLockedEnabledTab(tabKey: string): boolean {
  const key = tabKey.toLowerCase();
  return CONTACT_LOCKED_ENABLED_TABS.some((locked) => locked === key);
}

/** True when Setup must keep this field enabled and required. */
export function isContactLockedField(tabId: string, fieldKey: string): boolean {
  const locked = CONTACT_LOCKED_FIELD_KEYS[tabId.toLowerCase()];
  return locked?.includes(fieldKey) === true;
}

/** Seed form tabs (not tenant `custom_*` collection tabs), including retired `custom`. */
const CONTACT_SEED_FORM_TAB_KEYS = new Set([
  ...DEFAULT_FORM_TABS.map((tab) => tab.key.toLowerCase()),
  CONTACT_LEGACY_CUSTOM_FORM_TAB_KEY,
]);

/** True when `tabKey` is a seeded Contacts form tab (not a tenant custom tab). */
export function isContactSeedFormTab(tabKey: string): boolean {
  return CONTACT_SEED_FORM_TAB_KEYS.has(tabKey.toLowerCase());
}

/**
 * True when `tabKey` is a tenant-created form tab (e.g. `custom_*`).
 * These tabs store an array of row objects on the contact (like phones/emails).
 */
export function isContactCustomCollectionTab(tabKey: string): boolean {
  return !isContactSeedFormTab(tabKey);
}

/**
 * Ensures locked Contacts form tabs are present in an enabled-tab id list.
 * Comparison is case-insensitive; returned ids are lowercased.
 */
export function withContactLockedEnabledTabs(tabIds: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const tabId of tabIds) {
    const trimmed = tabId.trim();
    if (trimmed) {
      set.add(trimmed);
      set.add(trimmed.toLowerCase());
    }
  }
  for (const locked of CONTACT_LOCKED_ENABLED_TABS) {
    set.add(locked);
  }
  return [...set];
}

function tabVisibleIgnoringEnabledFlag(viewerRole: string, tab: TabDefinition): boolean {
  if (!tab.permissions?.length) return true;
  return tab.permissions.includes(viewerRole);
}

/**
 * Resolves which Contacts form tabs are active for a viewer.
 * When `formTabs` exist, their `enabled` flags are authoritative (plus locked tabs).
 * Otherwise falls back to {@link DEFAULT_ENABLED_TABS} ∪ `enabledTabs`.
 */
export function resolveContactEnabledTabIds(
  fieldConfig: Pick<FieldConfig, "formTabs" | "enabledTabs">,
  viewerRole: string,
): Set<string> {
  const formTabs = fieldConfig.formTabs;
  if (formTabs && formTabs.length > 0) {
    const activeFromTabs = formTabs
      .filter((tab) => {
        if (isContactLockedEnabledTab(tab.key)) {
          return tabVisibleIgnoringEnabledFlag(viewerRole, tab);
        }
        return canViewContactTab(viewerRole, tab);
      })
      .map((tab) => tab.key);
    return new Set(withContactLockedEnabledTabs(activeFromTabs));
  }

  return new Set(
    withContactLockedEnabledTabs([...DEFAULT_ENABLED_TABS, ...(fieldConfig.enabledTabs || [])]),
  );
}
