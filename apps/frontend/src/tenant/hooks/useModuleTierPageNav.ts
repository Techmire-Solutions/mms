import type { AppTranslationKey } from "@mms/shared";
import { resolveModuleTierTab } from "@mms/shared";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { MEDIA_LG_UP } from "@/lib/breakpoints";
import { useFilteredModuleTierTabs, type ModuleTierTab } from "@/tenant/hooks/useModuleTierTabs";
import {
  useModulePermissions,
  type ModulePermissionsManifest,
  type UseModulePermissionsResult,
} from "@/tenant/hooks/usePermissions";

export interface ModuleTierPageNavOptions {
  manifest: ModulePermissionsManifest;
  /** Product label for the primary operational tab (`nav.*`), not `module.work`. */
  workLabelKey: AppTranslationKey;
  /** Persisted UI-state key for the active tier (e.g. `students_active_tab`). */
  storageKey: string;
  defaultTab?: string;
}

export interface ModuleTierPageNavResult extends UseModulePermissionsResult {
  visibleTabs: ModuleTierTab[];
  /** Persisted tier from UI state (may be filtered out of `visibleTabs`). */
  activeTab: string;
  /** Active tier reconciled against `visibleTabs` — safe to render. */
  effectiveTab: string;
  setActiveTab: (tab: string) => void;
}

/**
 * Invariant tier-navigation prefix shared by standard module page controllers:
 * resolve permissions → filtered tier tabs → persisted active tab → reconciled
 * effective tab. Module-specific work-query/overlay composition stays in the module.
 */
export function useModuleTierPageNav({
  manifest,
  workLabelKey,
  storageKey,
  defaultTab = "work",
}: ModuleTierPageNavOptions): ModuleTierPageNavResult {
  const permissions = useModulePermissions(manifest);
  const visibleTabs = useFilteredModuleTierTabs({
    canViewSetup: permissions.canViewSetup,
    canViewReports: permissions.canReports,
    workLabelKey,
  });
  const [activeTab, setActiveTab] = usePersistedTabState<string>(storageKey, defaultTab);
  const isDesktop = useMediaQuery(MEDIA_LG_UP);
  const resolvedTab = resolveModuleTierTab(
    activeTab,
    visibleTabs.map((tab) => tab.id),
  );
  // `""` is the mobile accordion's collapsed state. Persisted into a desktop
  // session it would render a module with no body at all, so desktop resolves
  // the collapsed key back to the first visible tier.
  const effectiveTab =
    isDesktop && resolvedTab === "" ? (visibleTabs[0]?.id ?? defaultTab) : resolvedTab;

  return { ...permissions, visibleTabs, activeTab, effectiveTab, setActiveTab };
}
