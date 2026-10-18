import type React from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { EmptyState } from "@/components/app/EmptyState";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/data/attendanceData";
import {
  AttendanceCard,
  type AttendanceCardProps,
} from "@/tenant/features/attendance/components/AttendanceCard";

export { AttendanceCard, type AttendanceCardProps };

export interface AttendanceListCardsProps {
  paginatedRecords: AttendanceRecord[];
  isColumnVisible: (key: string) => boolean;
  editingRecord: AttendanceRecord | null;
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
  t: TranslationFunction;
}

export type AttendanceRecordsMobileListProps = AttendanceListCardsProps;

export function AttendanceListCards({
  paginatedRecords,
  isColumnVisible,
  editingRecord,
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
  t,
}: AttendanceRecordsMobileListProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const pageCountLabel = formatDirectoryPageCountLabel(paginatedRecords.length, t, {
    singular: "attendance.item.record",
    plural: "attendance.item.records",
  });

  if (paginatedRecords.length === 0) {
    return (
      <EmptyState
        title={t("attendance.empty.records")}
        description={t("attendance.empty.recordsHint")}
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      <EntityCardsGrid
        items={paginatedRecords}
        selectedIds={selectedIds}
        onSelectAll={canDelete ? () => onToggleSelectAll(!allVisibleSelected) : undefined}
        allSelected={allVisibleSelected}
        someSelected={someVisibleSelected}
        selectAllLabel={t("attendance.trash.selectAll")}
        deselectAllLabel={t("common.deselect")}
        selectedCountLabel={t("attendance.trash.selected", { count: selectedIds.length })}
        pageCountLabel={pageCountLabel}
        checkboxIdPrefix="attendance-select-cards"
        renderItem={(attendanceRecord) => (
          <AttendanceCard
            key={attendanceRecord.id}
            attendanceRecord={attendanceRecord}
            isColumnVisible={isColumnVisible}
            editingRecord={editingRecord}
            statuses={statuses}
            updateDraft={updateDraft}
            renderRowActions={renderRowActions}
            classLabel={classLabel}
            selectedIds={selectedIds}
            canDelete={canDelete}
            onToggleSelectedRecord={onToggleSelectedRecord}
            reducedMotion={reducedMotion}
            t={t}
          />
        )}
      />
    </div>
  );
}
