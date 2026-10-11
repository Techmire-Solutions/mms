import React from "react";
import type { WorkBatchTableColumn } from "@/components/common/work";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/data/attendanceData";
import { AttendanceRecordStatusCell } from "@/tenant/features/attendance/components/AttendanceRecordStatusCell";
import { TimePicker } from "@/components/ui/TimePicker";
import { formatDate } from "@mms/shared";

export interface UseAttendanceTableColumnsOptions {
  isColumnVisible: (key: string) => boolean;
  editingRecord: AttendanceRecord | null;
  statuses: AttendanceStatus[];
  updateDraft: <K extends keyof AttendanceRecord>(key: K, value: AttendanceRecord[K]) => void;
  classLabel: (classId: string) => string;
  t: TranslationFunction;
}

export function useAttendanceTableColumns({
  isColumnVisible,
  editingRecord,
  statuses,
  updateDraft,
  classLabel,
  t,
}: UseAttendanceTableColumnsOptions): WorkBatchTableColumn<AttendanceRecord>[] {
  return React.useMemo<WorkBatchTableColumn<AttendanceRecord>[]>(() => {
    const cols: WorkBatchTableColumn<AttendanceRecord>[] = [];

    if (isColumnVisible("date")) {
      cols.push({
        id: "date",
        label: t("attendance.columns.date"),
        noWrap: true,
        render: (r: AttendanceRecord) => (
          <span className="font-mono text-xs text-foreground">{formatDate(r.date, true)}</span>
        ),
      });
    }

    if (isColumnVisible("class")) {
      cols.push({
        id: "class",
        label: t("attendance.columns.class"),
        noWrap: true,
        render: (r: AttendanceRecord) => (
          <span className="text-foreground">{classLabel(r.classId)}</span>
        ),
      });
    }

    if (isColumnVisible("session")) {
      cols.push({
        id: "session",
        label: t("attendance.columns.session"),
        noWrap: true,
        render: (r: AttendanceRecord) => (
          <span className="text-foreground">{r.sessionName || "—"}</span>
        ),
      });
    }

    if (isColumnVisible("student")) {
      cols.push({
        id: "student",
        label: t("attendance.columns.student"),
        noWrap: true,
        render: (r: AttendanceRecord) => (
          <span className="font-semibold text-foreground">{r.studentName}</span>
        ),
      });
    }

    if (isColumnVisible("status")) {
      cols.push({
        id: "status",
        label: t("attendance.columns.status"),
        noWrap: true,
        render: (r: AttendanceRecord) => (
          <AttendanceRecordStatusCell
            attendanceRecord={r}
            editingRecord={editingRecord}
            statuses={statuses}
            updateDraft={updateDraft}
          />
        ),
      });
    }

    if (isColumnVisible("timeIn")) {
      cols.push({
        id: "timeIn",
        label: t("attendance.columns.timeIn"),
        noWrap: true,
        render: (r: AttendanceRecord) =>
          editingRecord?.id === r.id ? (
            <TimePicker
              id={`attendance-time-in-${r.id}`}
              name="timeIn"
              value={editingRecord.timeIn}
              onChange={(nextValue) => updateDraft("timeIn", nextValue)}
              aria-label={t("attendance.columns.timeIn")}
              className="w-full min-w-attendance-status max-w-attendance-status text-xs"
            />
          ) : (
            <span className="text-xs text-muted-foreground font-mono">{r.timeIn || "—"}</span>
          ),
      });
    }

    if (isColumnVisible("timeOut")) {
      cols.push({
        id: "timeOut",
        label: t("attendance.columns.timeOut"),
        noWrap: true,
        render: (r: AttendanceRecord) =>
          editingRecord?.id === r.id ? (
            <TimePicker
              id={`attendance-time-out-${r.id}`}
              name="timeOut"
              value={editingRecord.timeOut}
              onChange={(nextValue) => updateDraft("timeOut", nextValue)}
              aria-label={t("attendance.columns.timeOut")}
              className="w-full min-w-attendance-status max-w-attendance-status text-xs"
            />
          ) : (
            <span className="text-xs text-muted-foreground font-mono">{r.timeOut || "—"}</span>
          ),
      });
    }

    if (isColumnVisible("notes")) {
      cols.push({
        id: "notes",
        label: t("attendance.columns.notes"),
        truncate: true,
        cellClassName: "max-w-cell-sm text-xs text-muted-foreground",
        render: (r: AttendanceRecord) => r.notes || "—",
      });
    }

    return cols;
  }, [classLabel, editingRecord, isColumnVisible, statuses, t, updateDraft]);
}
