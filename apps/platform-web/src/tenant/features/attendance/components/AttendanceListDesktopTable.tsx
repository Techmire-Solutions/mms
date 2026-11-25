import React from "react";
import { EmptyState } from "@mms/ui";
import { WorkBatchTable } from "@/components/common";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { formatDirectoryPageCountLabel } from "@mms/fe-core/tenant/formatDirectoryPageCountLabel";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/data/attendanceData";
import { useAttendanceTableColumns } from "@/tenant/features/attendance/hooks/useAttendanceTableColumns";

export interface AttendanceListDesktopTableProps {
  paginatedRecords: AttendanceRecord[];
  isColumnVisible: (key: string) => boolean;
  visibleColCount: number;
  editingRecord: AttendanceRecord | null;
  /** Inline save/validation error for the record being edited (rendered in its row). */
  editingRecordError?: string | null;
  statuses: AttendanceStatus[];
  updateDraft: <K extends keyof AttendanceRecord>(key: K, value: AttendanceRecord[K]) => void;
  classLabel: (classId: string) => string;
  renderRowActions: (attendanceRecord: AttendanceRecord) => React.ReactNode;
  selectedIds: string[];
  canDelete: boolean;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectedRecord: (id: string, checked: boolean) => void;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  t: TranslationFunction;
}

export function AttendanceListDesktopTable({
  paginatedRecords,
  isColumnVisible,
  visibleColCount: _visibleColCount,
  editingRecord,
  editingRecordError,
  statuses,
  updateDraft,
  classLabel,
  renderRowActions,
  selectedIds,
  canDelete,
  allVisibleSelected,
  someVisibleSelected,
  onToggleSelectAll,
  onToggleSelectedRecord,
  getColumnWidth,
  onColumnResize,
  t,
}: AttendanceListDesktopTableProps): React.JSX.Element {
  const recordsCountLabel = formatDirectoryPageCountLabel(paginatedRecords.length, t, {
    singular: "attendance.item.record",
    plural: "attendance.item.records",
  });
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const columns = useAttendanceTableColumns({
    isColumnVisible,
    editingRecord,
    editingRecordError,
    statuses,
    updateDraft,
    classLabel,
    t,
  });

  return (
    <WorkBatchTable
      data={paginatedRecords}
      columns={columns}
      selection={
        canDelete
          ? {
              selectedIds,
              onSelectOne: (id) => onToggleSelectedRecord(id, !selectedSet.has(id)),
              onSelectAll: () => onToggleSelectAll(!allVisibleSelected),
              allSelected: allVisibleSelected,
              someSelected: someVisibleSelected,
              selectAllAriaLabel: t("attendance.trash.selectAll"),
              selectRowAriaLabel: (r) =>
                t("attendance.trash.selectRecord", { student: r.studentName }),
            }
          : undefined
      }
      columnResize={{
        getColumnWidth,
        onColumnResize,
      }}
      renderRowActions={renderRowActions}
      emptyState={
        <EmptyState
          title={t("attendance.empty.records")}
          description={t("attendance.empty.recordsHint")}
          compact
        />
      }
      footerCount={{
        selectedCountLabel: t("attendance.selectedCount", { count: selectedIds.length }),
        pageCountLabel: recordsCountLabel,
      }}
    />
  );
}
