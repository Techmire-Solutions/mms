import { useCallback, useMemo } from "react";
import type { PlatformUserProfile } from "@mms/shared";
import { useWorkSelection } from "@/hooks/useWorkSelection";

export interface UsePlatformAdminSelectionResult {
  selectedIds: string[];
  selectedAdminSet: ReadonlySet<string>;
  selectedAdmins: PlatformUserProfile[];
  selectedCount: number;
  handleToggleSelect: (id: string) => void;
  handleToggleSelectAll: (visibleAdmins: PlatformUserProfile[]) => void;
  clearSelection: () => void;
}

export function usePlatformAdminSelection(
  allAdmins: PlatformUserProfile[],
): UsePlatformAdminSelectionResult {
  const { selectedIds, toggleSelected, toggleSelectAll, clearSelection } =
    useWorkSelection<string>();

  const selectedAdminSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedAdmins = useMemo(
    () => allAdmins.filter((a) => selectedAdminSet.has(a.id)),
    [allAdmins, selectedAdminSet],
  );

  const handleToggleSelect = useCallback(
    (id: string) => {
      toggleSelected(id, !selectedAdminSet.has(id));
    },
    [toggleSelected, selectedAdminSet],
  );

  const handleToggleSelectAll = useCallback(
    (visibleAdmins: PlatformUserProfile[]) => {
      const visibleIds = visibleAdmins.map((a) => a.id);
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => selectedAdminSet.has(id));
      toggleSelectAll(!allSelected, visibleIds);
    },
    [selectedAdminSet, toggleSelectAll],
  );

  return {
    selectedIds,
    selectedAdminSet,
    selectedAdmins,
    selectedCount: selectedAdminSet.size,
    handleToggleSelect,
    handleToggleSelectAll,
    clearSelection,
  };
}
