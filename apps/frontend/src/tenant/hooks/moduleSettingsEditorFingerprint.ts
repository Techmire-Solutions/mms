import type { FieldDefinition, TabDefinition } from "@mms/shared";
import { canonicalizeFieldsMap } from "@/lib/setup/canonicalizeFields";

function canonicalizeFormTabs(
  formTabs: TabDefinition[] | undefined,
): Array<{ key: string; enabled: boolean; label?: string; order: number }> {
  return (formTabs || [])
    .map((tab) => ({
      key: tab.key.toLowerCase(),
      enabled: tab.enabled !== false,
      label: tab.label,
      order: tab.order ?? 0,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Content fingerprint for fields-editor rehydrate.
 * Same content → same string even when `settings` object identity churns.
 * Field map is formTabs-scoped (Setup snapshot SSOT) via shared canonicalizeFieldsMap.
 */
export function moduleSettingsEditorFingerprint(input: {
  fields?: Record<string, FieldDefinition[]>;
  enabledTabs?: string[];
  requiredTabs?: string[];
  formTabs?: TabDefinition[];
  tabRegistry: Array<{ key: string }>;
  resolvedDefaultEnabledTabs: string[];
  defaultRequiredTabs?: string[];
}): string {
  const enabledSource =
    input.enabledTabs && input.enabledTabs.length > 0
      ? input.enabledTabs
      : input.resolvedDefaultEnabledTabs;
  const enabled = [...enabledSource]
    .map((tabId) => tabId.trim().toLowerCase())
    .filter(Boolean)
    .sort();
  const required = [...(input.requiredTabs || input.defaultRequiredTabs || [])]
    .map((tabId) => tabId.toLowerCase())
    .sort();
  const registry = input.tabRegistry.map((tab) => tab.key.toLowerCase()).sort();

  return JSON.stringify({
    fields: canonicalizeFieldsMap(input.fields, input.formTabs ?? []),
    enabled,
    required,
    formTabs: canonicalizeFormTabs(input.formTabs),
    registry,
  });
}
