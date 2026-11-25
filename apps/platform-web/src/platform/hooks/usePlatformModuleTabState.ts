import { useSearchParams } from "react-router-dom";
import { usePersistedTabState } from "@mms/fe-core/lib/usePersistedTabState";
import type { ModuleTierTab } from "@mms/fe-core/lib/useModuleTierTabs";

/**
 * Active-tier state for a platform module: seeded from `?tab=`, persisted via
 * backend UI state, resolved against the visible tier ids, and synced back to
 * the URL on change (Work clears `?tab`).
 */
export function usePlatformModuleTabState(storageKey: string, tabs: readonly ModuleTierTab[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const visibleIds: string[] = tabs.map((tab) => tab.id);
  const firstVisible = visibleIds[0] ?? "work";

  const [activeTab, setActiveTab] = usePersistedTabState<string>(
    storageKey,
    raw && visibleIds.includes(raw) ? raw : firstVisible,
  );

  const resolvedTab = visibleIds.includes(activeTab) ? activeTab : firstVisible;

  const handleTabChange = (id: string): void => {
    setActiveTab(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === "work") next.delete("tab");
        else next.set("tab", id);
        return next;
      },
      { replace: true },
    );
  };

  return { activeTab: resolvedTab, handleTabChange };
}
