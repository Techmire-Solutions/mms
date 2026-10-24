import {
  DEFAULT_STUDENT_ENABLED_TABS,
  type FieldDefinition,
  type StudentsSettings,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

/** Detail-drawer field row: registry field pinned to its enabled tab and sort position. */
export interface StudentDetailFieldDef {
  key: string;
  label: string;
  labelKey?: FieldDefinition["labelKey"];
  type: string;
  tab: string;
  enabled: boolean;
  order: number;
  group: string;
}

/**
 * Enabled detail fields sorted by tab order then per-field order; basic tab always shows.
 * `basic` is excluded from tab gating (unlocked by definition), `group` falls back to a localized label.
 */
export function buildStudentSortedEnabledFields(
  settings: StudentsSettings,
  t: TranslationFunction,
): StudentDetailFieldDef[] {
  const fieldTabMap = settings.fields || {};
  const tabOrderMap: Record<string, number> = (() => {
    const tabs = settings.formTabs || [];
    return Object.fromEntries(tabs.map((tab, tabIndex) => [tab.key, tabIndex]));
  })();
  const enabledTabIds = new Set(settings.enabledTabs || DEFAULT_STUDENT_ENABLED_TABS);

  const list: StudentDetailFieldDef[] = [];

  Object.entries(fieldTabMap).forEach(([tabId, tabFields]) => {
    if (tabId !== "basic" && !enabledTabIds.has(tabId)) return;
    (tabFields as FieldDefinition[]).forEach((fieldDefinition) => {
      if (fieldDefinition.enabled) {
        list.push({
          key: fieldDefinition.key,
          label: fieldDefinition.label,
          labelKey: fieldDefinition.labelKey,
          type: fieldDefinition.type,
          tab: tabId,
          enabled: fieldDefinition.enabled,
          order: fieldDefinition.order,
          group: fieldDefinition.group?.trim() || t("students.detail.extendedProfiles"),
        });
      }
    });
  });

  return list.sort((a, b) => {
    const aTabIdx = tabOrderMap[a.tab] ?? 9999;
    const bTabIdx = tabOrderMap[b.tab] ?? 9999;
    if (aTabIdx !== bTabIdx) {
      return aTabIdx - bTabIdx;
    }
    return (a.order ?? 999) - (b.order ?? 999);
  });
}
