import {
  FACULTY_TAB_REGISTRY,
  isFacultyLockedEnabledTab,
  listFacultySystemFormFieldKeys,
  resolveFacultyEnabledTabIds,
  resolveFacultyFieldsMapForColumnSync,
  type FieldDefinition,
  type FacultySettings,
} from "@mms/shared";

export type FacultyDetailFieldRow = {
  key: string;
  label: string;
  labelKey?: FieldDefinition["labelKey"];
  type: string;
  tab: string;
  order: number;
  isCustom: boolean;
};

/**
 * Enabled Setup fields for FacultyDetail, ordered by formTabs then field order.
 * Locked `basic` always participates; other tabs follow `enabledTabs`.
 */
export function listFacultyDetailAttributeFields(
  settings: FacultySettings,
): FacultyDetailFieldRow[] {
  const fields = resolveFacultyFieldsMapForColumnSync(settings.fields);
  const formTabs =
    settings.formTabs && settings.formTabs.length > 0 ? settings.formTabs : FACULTY_TAB_REGISTRY;
  const tabOrderMap = Object.fromEntries(formTabs.map((tab, index) => [tab.key, index]));
  const enabledTabIds = new Set(resolveFacultyEnabledTabIds(settings));
  const systemKeys = listFacultySystemFormFieldKeys();

  const list: FacultyDetailFieldRow[] = [];
  for (const [tabId, tabFields] of Object.entries(fields)) {
    if (!isFacultyLockedEnabledTab(tabId) && !enabledTabIds.has(tabId)) continue;
    for (const field of tabFields) {
      if (!field.enabled) continue;
      list.push({
        key: field.key,
        label: field.label,
        labelKey: field.labelKey,
        type: field.type,
        tab: tabId,
        order: field.order ?? 0,
        isCustom: !systemKeys.has(field.key),
      });
    }
  }

  return list.sort((left, right) => {
    const leftTab = tabOrderMap[left.tab] ?? 9999;
    const rightTab = tabOrderMap[right.tab] ?? 9999;
    if (leftTab !== rightTab) return leftTab - rightTab;
    return left.order - right.order;
  });
}
