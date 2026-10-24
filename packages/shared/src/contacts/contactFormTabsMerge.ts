import type { FieldDefinition, TabDefinition } from "./contactFieldSchemaTypes.js";
import { normalizeContactFormTabId } from "./contactEmergencyTabMigration.js";
import {
  DEFAULT_FORM_TABS,
  omitContactLegacyCustomFormTabUnlessUsed,
} from "./contactTabRegistry.js";

function normalizeFormTab(tab: TabDefinition): TabDefinition {
  const key = normalizeContactFormTabId(tab.key);
  return {
    ...tab,
    key,
    label: tab.key === "emergency" || tab.label === "Emergency" ? "Relationship" : tab.label,
  };
}

/**
 * Merge API custom_tabs with document/default form tabs for Contacts Setup/forms.
 *
 * - Empty API → document tabs when present, else {@link DEFAULT_FORM_TABS}.
 * - Non-empty API → API membership + missing seed tabs from {@link DEFAULT_FORM_TABS} only.
 * - Drops retired empty seed `custom` unless `fields` still has definitions under that tab.
 */
export function mergeContactsFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
  fields?: Record<string, FieldDefinition[]> | undefined,
): TabDefinition[] {
  const normalizedApi = apiTabs.map(normalizeFormTab);
  const documentOrDefault =
    documentFormTabs && documentFormTabs.length > 0
      ? documentFormTabs.map(normalizeFormTab)
      : [...DEFAULT_FORM_TABS];

  const merged =
    normalizedApi.length === 0
      ? documentOrDefault
      : [
          ...normalizedApi,
          ...DEFAULT_FORM_TABS.filter(
            (seedTab) =>
              !normalizedApi.some(
                (apiTab) => apiTab.key === normalizeContactFormTabId(seedTab.key),
              ),
          ).map(normalizeFormTab),
        ];

  const seenKeys = new Set<string>();
  const deduped = merged.filter((tab) => {
    if (seenKeys.has(tab.key)) return false;
    seenKeys.add(tab.key);
    return true;
  });

  return omitContactLegacyCustomFormTabUnlessUsed(deduped, fields);
}
