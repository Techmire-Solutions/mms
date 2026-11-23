import { useCallback, useMemo } from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { useWorkSelection } from "@/hooks/useWorkSelection";

export interface UsePlatformWorkspaceSelectionResult {
  selectedSubdomains: ReadonlySet<string>;
  selectedWorkspaces: PlatformWorkspaceRowData[];
  selectedCount: number;
  isAllSelected: boolean;
  isSelected: (subdomain: string) => boolean;
  toggleSelect: (subdomain: string) => void;
  toggleSelectAll: (visibleWorkspaces: PlatformWorkspaceRowData[]) => void;
  clearSelection: () => void;
}

/**
 * Workspace row selection for the Platform Workspaces directory — thin adapter
 * over the shared `useWorkSelection` SSOT (mirrors `usePlatformAdminSelection`).
 */
export function usePlatformWorkspaceSelection(
  allWorkspaces: PlatformWorkspaceRowData[],
): UsePlatformWorkspaceSelectionResult {
  const { selectedIds, toggleSelected, toggleSelectAll, clearSelection } =
    useWorkSelection<string>();

  const selectedSubdomains = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedWorkspaces = useMemo(
    () => allWorkspaces.filter((w) => selectedSubdomains.has(w.subdomain)),
    [allWorkspaces, selectedSubdomains],
  );

  const isSelected = useCallback(
    (subdomain: string) => selectedSubdomains.has(subdomain),
    [selectedSubdomains],
  );

  const toggleSelect = useCallback(
    (subdomain: string) => {
      toggleSelected(subdomain, !selectedSubdomains.has(subdomain));
    },
    [toggleSelected, selectedSubdomains],
  );

  const toggleSelectAllWorkspaces = useCallback(
    (visibleWorkspaces: PlatformWorkspaceRowData[]) => {
      const visibleIds = visibleWorkspaces.map((w) => w.subdomain);
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => selectedSubdomains.has(id));
      toggleSelectAll(!allSelected, visibleIds);
    },
    [selectedSubdomains, toggleSelectAll],
  );

  const isAllSelected = useMemo(
    () =>
      allWorkspaces.length > 0 && allWorkspaces.every((w) => selectedSubdomains.has(w.subdomain)),
    [allWorkspaces, selectedSubdomains],
  );

  return {
    selectedSubdomains,
    selectedWorkspaces,
    selectedCount: selectedSubdomains.size,
    isAllSelected,
    isSelected,
    toggleSelect,
    toggleSelectAll: toggleSelectAllWorkspaces,
    clearSelection,
  };
}
