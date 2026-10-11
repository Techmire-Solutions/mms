import { SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { AppTranslationKey, TabDefinition } from "@mms/shared";

export type FormModalTabItem = {
  key: string;
  labelKey?: AppTranslationKey;
  icon: LucideIcon;
  label: string;
};

/**
 * Shared FormModal tab resolver — sort persisted Setup `formTabs` by `order`,
 * filter via the module's gating predicate, and map to `{ key, labelKey, label, icon }`
 * with a `SlidersHorizontal` fallback. Module adapters (Teachers/Students/Contacts)
 * supply their tab registry, icon map, and enablement rules.
 */
export function createFormModalTabs(options: {
  icons: Record<string, LucideIcon>;
  fallbackIcon?: LucideIcon;
  isTabEnabled: (tab: TabDefinition, enabledTabIds?: ReadonlySet<string>) => boolean;
  resolveSource?: (formTabs: TabDefinition[] | undefined, fields?: unknown) => TabDefinition[];
}) {
  const { icons, isTabEnabled, resolveSource } = options;
  const fallbackIcon = options.fallbackIcon ?? SlidersHorizontal;

  return function resolveFormModalTabs(
    formTabs?: TabDefinition[],
    enabledTabIds?: ReadonlySet<string>,
    fields?: unknown,
  ): FormModalTabItem[] {
    const source = resolveSource
      ? resolveSource(formTabs, fields)
      : formTabs && formTabs.length > 0
        ? formTabs
        : [];

    const sorted = source.slice().sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

    return sorted
      .filter((tab) => isTabEnabled(tab, enabledTabIds))
      .map((tab) => ({
        key: tab.key,
        labelKey: tab.labelKey as AppTranslationKey | undefined,
        label: tab.label,
        icon: icons[tab.key] ?? fallbackIcon,
      }));
  };
}
