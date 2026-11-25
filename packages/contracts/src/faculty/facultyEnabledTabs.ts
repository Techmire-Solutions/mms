import type { TabDefinition } from "../contacts/contactFieldSchemaTypes.js";
import {
  FACULTY_LOCKED_ENABLED_TABS,
  FACULTY_TAB_REGISTRY,
} from "../settings/moduleFieldSetupPersons.js";

/** Person-level hierarchy UI retired — never treat as an enabled form tab. */
const RETIRED_FACULTY_FORM_TABS = new Set(["hierarchy"]);

/** Default enabled tab ids from the Faculty tab registry seed. */
export function defaultFacultyEnabledTabIds(): string[] {
  return FACULTY_TAB_REGISTRY.filter(
    (tab) => tab.enabled !== false && !RETIRED_FACULTY_FORM_TABS.has(tab.key),
  ).map((tab) => tab.key);
}

export type FacultyEnabledTabsInput = {
  enabledTabs?: readonly string[] | null;
  formTabs?: readonly TabDefinition[] | null;
};

function withFacultyLockedEnabledTabs(tabIds: Iterable<string>): string[] {
  const set = new Set(
    [...tabIds]
      .map((tabId) => tabId.trim())
      .filter((tabId) => Boolean(tabId) && !RETIRED_FACULTY_FORM_TABS.has(tabId)),
  );
  for (const locked of FACULTY_LOCKED_ENABLED_TABS) {
    set.add(locked);
  }
  return [...set];
}

/**
 * Resolves Faculty form / Setup / detail / export enabled tab ids.
 * When `formTabs` is non-empty, each tab's `enabled` flag is authoritative (Contacts-shaped).
 * Otherwise falls back to non-empty `enabledTabs`, then registry defaults.
 * Locked tabs ({@link FACULTY_LOCKED_ENABLED_TABS}) are always included.
 */
export function resolveFacultyEnabledTabIds(settings?: FacultyEnabledTabsInput | null): string[] {
  const formTabs = settings?.formTabs;
  if (formTabs && formTabs.length > 0) {
    const fromFormTabs = formTabs.filter((tab) => tab.enabled !== false).map((tab) => tab.key);
    return withFacultyLockedEnabledTabs(fromFormTabs);
  }

  const enabledTabs = settings?.enabledTabs;
  const source =
    enabledTabs && enabledTabs.length > 0
      ? enabledTabs.filter((tabId) => Boolean(tabId?.trim()))
      : defaultFacultyEnabledTabIds();
  return withFacultyLockedEnabledTabs(source);
}
