import React from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import type { WorkBatchTableColumn } from "@/components/common/work/workBatchTableTypes";
import { useTranslation } from "@/hooks/useTranslation";
import { getAttendanceStatusInfo, type AttendanceStatus } from "@/lib/data/attendanceData";
import { MarkAttendanceFieldControl } from "./MarkAttendanceFieldControl";
import type { ModuleFieldDef } from "@mms/shared";
import type { AttendanceRow } from "./markAttendanceTypes";

export interface MarkAttendanceTableViewProps {
  rows: AttendanceRow[];
  enabledFields: ModuleFieldDef[];
  statuses: AttendanceStatus[];
  onFieldChange: (studentId: string, key: string, value: unknown) => void;
}

export function MarkAttendanceTableView({
  rows,
  enabledFields,
  statuses,
  onFieldChange,
}: MarkAttendanceTableViewProps): React.JSX.Element {
  const { t } = useTranslation();

  const columns: WorkBatchTableColumn<AttendanceRow & { id: string }>[] = [
    {
      id: "rollNo",
      label: "#",
      headerClassName: "w-8 text-start uppercase",
      cellClassName: "text-xs text-muted-foreground font-mono",
      noWrap: true,
      render: (row) => row.rollNo,
    },
    {
      id: "name",
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
  ];

  const tableData = rows.map((r) => ({ ...r, id: r.studentId }));
  const isVirtualized = tableData.length > 30;

  return (
    <WorkBatchTable
      data={tableData}
      columns={columns}
      virtualize={isVirtualized}
      maxHeightClassName="max-h-160"
      rowClassName={(row) => {
        const statusInfo = getAttendanceStatusInfo(row.status, statuses);
        return statusInfo?.bg ? statusInfo.bg : undefined;
      }}
      emptyState={<EmptyState title={t("attendance.mark.noStudents")} compact />}
    />
  );
}
