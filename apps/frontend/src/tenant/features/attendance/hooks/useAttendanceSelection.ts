import { useCallback, useState } from "react";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

/** Work directory row selection SSOT for attendance records (person-directory shape). */
export function useAttendanceSelection(records: AttendanceRecord[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    records.length > 0 && records.every((record) => selectedSet.has(record.id));
  const someVisibleSelected =
    selectedSet.size > 0 && records.some((record) => selectedSet.has(record.id));

  const toggleSelectAll = (checked: boolean) => {
    const visibleIds = records.map((record) => record.id);
    const visibleSet = new Set(visibleIds);
    setSelectedIds((currentIds) =>
      checked
        ? [...new Set([...currentIds, ...visibleIds])]
        : currentIds.filter((id) => !visibleSet.has(id)),
    );
  };

  const toggleSelectedRecord = (id: string, checked: boolean) => {
    setSelectedIds((currentIds) =>
      checked ? [...currentIds, id] : currentIds.filter((selectedId) => selectedId !== id),
    );
  };

  // Stable + no-op when empty: consumers clear selection from effects keyed on this callback.
  const clearSelection = useCallback(() => {
    setSelectedIds((currentIds) => (currentIds.length === 0 ? currentIds : []));
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelectedRecord,
    clearSelection,
  };
}
