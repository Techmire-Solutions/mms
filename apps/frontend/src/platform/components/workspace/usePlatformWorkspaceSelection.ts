import { useState, useCallback, useMemo } from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";

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

export function usePlatformWorkspaceSelection(
  allWorkspaces: PlatformWorkspaceRowData[],
): UsePlatformWorkspaceSelectionResult {
  const [selectedSubdomains, setSelectedSubdomains] = useState<Set<string>>(new Set());

  const selectedWorkspaces = useMemo(
    () => allWorkspaces.filter((w) => selectedSubdomains.has(w.subdomain)),
    [allWorkspaces, selectedSubdomains],
  );

  const isSelected = useCallback(
    (subdomain: string) => selectedSubdomains.has(subdomain),
    [selectedSubdomains],
  );

  const toggleSelect = useCallback((subdomain: string) => {
    setSelectedSubdomains((prev) => {
      const next = new Set(prev);
      if (next.has(subdomain)) {
        next.delete(subdomain);
      } else {
        next.add(subdomain);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((visibleWorkspaces: PlatformWorkspaceRowData[]) => {
    setSelectedSubdomains((prev) => {
      const visibleSet = new Set(visibleWorkspaces.map((w) => w.subdomain));
      const allVisibleSelected =
        visibleWorkspaces.length > 0 && visibleWorkspaces.every((w) => prev.has(w.subdomain));
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const sub of visibleSet) {
          next.delete(sub);
        }
      } else {
        for (const sub of visibleSet) {
          next.add(sub);
        }
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSubdomains(new Set());
  }, []);

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
    toggleSelectAll,
    clearSelection,
  };
}
