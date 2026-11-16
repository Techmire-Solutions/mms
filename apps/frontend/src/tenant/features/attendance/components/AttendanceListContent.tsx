import React from "react";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/data/attendanceData";
import { AttendanceListCards } from "./AttendanceListCards";
import { AttendanceListDesktopTable } from "./AttendanceListDesktopTable";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface AttendanceListContentProps {
  viewMode: "table" | "cards";
  paginatedRecords: AttendanceRecord[];
  isColumnVisible: (key: string) => boolean;
  visibleColCount: number;
  editingRecord: AttendanceRecord | null;
  /** Inline save/validation error for the record being edited. */
  editingRecordError?: string | null;
  statuses: AttendanceStatus[];
  updateDraft: <K extends keyof AttendanceRecord>(key: K, value: AttendanceRecord[K]) => void;
  classLabel: (cls: string) => string;
  renderRowActions: (record: AttendanceRecord) => React.ReactNode;
  renderRowActionsCards: (record: AttendanceRecord) => React.ReactNode;
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

export function AttendanceListContent(props: AttendanceListContentProps): React.JSX.Element {
  if (props.viewMode === "cards") {
    return (
      <AttendanceListCards
        paginatedRecords={props.paginatedRecords}
        isColumnVisible={props.isColumnVisible}
        editingRecord={props.editingRecord}
        editingRecordError={props.editingRecordError}
        statuses={props.statuses}
        updateDraft={props.updateDraft}
        classLabel={props.classLabel}
        renderRowActions={props.renderRowActionsCards}
        selectedIds={props.selectedIds}
        canDelete={props.canDelete}
        allVisibleSelected={props.allVisibleSelected}
        someVisibleSelected={props.someVisibleSelected}
        onToggleSelectAll={props.onToggleSelectAll}
        onToggleSelectedRecord={props.onToggleSelectedRecord}
        t={props.t}
      />
    );
  }

  return (
    <AttendanceListDesktopTable
      paginatedRecords={props.paginatedRecords}
      isColumnVisible={props.isColumnVisible}
      visibleColCount={props.visibleColCount}
      editingRecord={props.editingRecord}
      editingRecordError={props.editingRecordError}
      statuses={props.statuses}
      updateDraft={props.updateDraft}
      classLabel={props.classLabel}
      renderRowActions={props.renderRowActions}
      selectedIds={props.selectedIds}
      canDelete={props.canDelete}
      allVisibleSelected={props.allVisibleSelected}
      someVisibleSelected={props.someVisibleSelected}
      onToggleSelectAll={props.onToggleSelectAll}
      onToggleSelectedRecord={props.onToggleSelectedRecord}
      getColumnWidth={props.getColumnWidth}
      onColumnResize={props.onColumnResize}
      t={props.t}
    />
  );
}
