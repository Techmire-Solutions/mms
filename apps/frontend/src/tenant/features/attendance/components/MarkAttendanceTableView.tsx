import React, { useMemo } from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import type { WorkBatchTableColumn } from "@/components/common/work/workBatchTableTypes";
import { useTranslation } from "@/hooks/useTranslation";
import { getAttendanceStatusInfo, type AttendanceStatus } from "@/lib/data/attendanceData";
import { MarkAttendanceFieldControl } from "./MarkAttendanceFieldControl";
import type { ModuleFieldDef } from "@mms/shared";
import type { AttendanceRow } from "../lib/markAttendanceTypes";

export interface MarkAttendanceTableViewProps {
  rows: AttendanceRow[];
  enabledFields: ModuleFieldDef[];
  statuses: AttendanceStatus[];
  onFieldChange: (studentId: string, key: string, value: unknown) => void;
  /** Keyboard-navigation cursor (highlighted row). */
  activeStudentId?: string | null;
}

export function MarkAttendanceTableView({
  rows,
  enabledFields,
  statuses,
  onFieldChange,
  activeStudentId = null,
}: MarkAttendanceTableViewProps): React.JSX.Element {
  const { t } = useTranslation();

  // Rebuilt only when the field configuration or the translation changes, not on every keystroke.
  const columns: WorkBatchTableColumn<AttendanceRow & { id: string }>[] = useMemo(
    () => [
      {
        id: "rollNo",
        kind: "code",
        label: "#",
        headerClassName: "w-8 text-start uppercase",
        cellClassName: "text-xs text-muted-foreground font-mono",
        noWrap: true,
        render: (row) => row.rollNo,
      },
      {
        id: "name",
        kind: "identity",
        label: t("attendance.columns.student"),
        headerClassName: "text-start uppercase",
        cellClassName: "font-semibold text-foreground",
        noWrap: true,
        render: (row) => row.name,
      },
      ...enabledFields.map((field) => ({
        id: field.id,
        label: `${field.label} ${field.required ? "*" : ""}`,
        headerClassName: `uppercase ${field.id === "status" ? "text-center" : "text-start"} ${
          field.id === "timeIn" || field.id === "timeOut" ? "w-28" : ""
        }`,
        cellClassName: field.id === "status" ? "flex justify-center" : "",
        render: (row: AttendanceRow & { id: string }) => (
          <MarkAttendanceFieldControl
            row={row}
            field={field}
            idPrefix="table"
            onFieldChange={onFieldChange}
          />
        ),
      })),
    ],
    [enabledFields, onFieldChange, t],
  );

  const tableData = useMemo(() => rows.map((r) => ({ ...r, id: r.studentId })), [rows]);
  const isVirtualized = tableData.length > 30;

  return (
    <WorkBatchTable
      data={tableData}
      columns={columns}
      virtualize={isVirtualized}
      maxHeightClassName="max-h-160"
      rowClassName={(row) => {
        const statusInfo = getAttendanceStatusInfo(row.status, statuses);
        const base = statusInfo?.bg ?? "";
        // The keyboard cursor row is visibly distinct from the status tint.
        return row.studentId === activeStudentId
          ? `${base} outline outline-2 outline-primary/60 outline-offset-[-2px]`
          : base;
      }}
      emptyState={<EmptyState title={t("attendance.mark.noStudents")} compact />}
    />
  );
}
