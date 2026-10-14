import type { AppTranslationKey } from "@mms/shared";
import { resolveModuleTierTab } from "@mms/shared";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
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
  const effectiveTab = resolveModuleTierTab(
    activeTab,
    visibleTabs.map((tab) => tab.id),
  );

  return { ...permissions, visibleTabs, activeTab, effectiveTab, setActiveTab };
}
