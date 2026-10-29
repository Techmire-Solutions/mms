import { useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { History, Building2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/config/routes";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformWorkspaces } from "@/platform/hooks/usePlatformWorkspaces";
import {
  PLATFORM_STATIC_COMMANDS,
  buildWorkspaceCommandItems,
  commandItemIsPermitted,
  type PlatformCommandItem,
} from "@/platform/components/platformCommandItems";
import {
  loadRecentWorkspaces,
  saveRecentWorkspace,
  type RecentWorkspaceRecord,
} from "@/platform/lib/recentWorkspaces";

export type { RecentWorkspaceRecord };
export { loadRecentWorkspaces, saveRecentWorkspace };

export interface UseOmniCommandRegistryResult {
  items: PlatformCommandItem[];
  filterItems: (query: string) => PlatformCommandItem[];
  recordRecent: (workspace: RecentWorkspaceRecord) => void;
  recentWorkspaces: RecentWorkspaceRecord[];
  isActionOnlyMode: boolean;
}

function useCurrentPath(): string {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const loc = typeof useLocation === "function" ? useLocation() : undefined;
    return loc?.pathname ?? "";
  } catch {
    return typeof window !== "undefined" ? window.location.pathname : "";
  }
}

export function useOmniCommandRegistry(): UseOmniCommandRegistryResult {
  const { t } = useTranslation();
  const currentPath = useCurrentPath();
  const perms = usePlatformPermissions();
  const { data: workspaces } = usePlatformWorkspaces({ limit: 100 });
  const [recents, setRecents] = useState<RecentWorkspaceRecord[]>(() => loadRecentWorkspaces());

  const recordRecent = useCallback((workspace: RecentWorkspaceRecord) => {
    const updated = saveRecentWorkspace(workspace);
    setRecents(updated);
  }, []);

  const allAvailableItems = useMemo(() => {
    const permittedStatic = PLATFORM_STATIC_COMMANDS.filter((item) =>
      commandItemIsPermitted(item, perms),
    );

    const workspaceItems: PlatformCommandItem[] =
      perms.canWorkspaces && workspaces ? buildWorkspaceCommandItems(workspaces) : [];

    const recentItems: PlatformCommandItem[] = recents.map((r, idx) => ({
      id: `recent-${r.subdomain}`,
      customLabel: r.madrasaName,
      customSubtitle: r.subdomain,
      category: "platform.commandCategory.recent",
      path: `${ROUTES.platformWorkspaces}?q=${encodeURIComponent(r.subdomain)}`,
      icon: idx === 0 ? History : Building2,
      keywords: [r.subdomain, r.madrasaName, "recent", "history"],
      badge: "Recent",
    }));

    return [...recentItems, ...permittedStatic, ...workspaceItems];
  }, [perms, workspaces, recents]);

  const filterItems = useCallback(
    (rawQuery: string): PlatformCommandItem[] => {
      const trimmed = rawQuery.trim();
      const isActionPrefix = trimmed.startsWith(">");
      const q = isActionPrefix ? trimmed.slice(1).trim().toLowerCase() : trimmed.toLowerCase();

      let candidatePool = allAvailableItems;

      if (isActionPrefix) {
        candidatePool = allAvailableItems.filter(
          (item) => item.category === "platform.commandCategory.actions",
        );
        if (!q) return candidatePool;
      }

      if (!q) {
        // Context-sensitive prioritization when query is empty:
        return [...candidatePool].sort((a, b) => {
          // Keep recents first
          if (
            a.category === "platform.commandCategory.recent" &&
            b.category !== "platform.commandCategory.recent"
          )
            return -1;
          if (
            b.category === "platform.commandCategory.recent" &&
            a.category !== "platform.commandCategory.recent"
          )
            return 1;

          // Route-aware affinity boosting
          const aMatch = Boolean(currentPath) && a.path.startsWith(currentPath);
          const bMatch = Boolean(currentPath) && b.path.startsWith(currentPath);
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });
      }

      return candidatePool.filter((item) => {
        const label = item.customLabel ?? (item.labelKey ? t(item.labelKey) : "");
        const subtitle = item.customSubtitle ?? "";
        return (
          label.toLowerCase().includes(q) ||
          subtitle.toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q))
        );
      });
    },
    [allAvailableItems, currentPath, t],
  );

  return {
    items: allAvailableItems,
    filterItems,
    recordRecent,
    recentWorkspaces: recents,
    isActionOnlyMode: false,
  };
}
