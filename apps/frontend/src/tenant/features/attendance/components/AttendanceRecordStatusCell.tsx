import type React from "react";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import {
  getAttendanceStatusInfo,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@/lib/data/attendanceData";
import { StatusToggle } from "@/tenant/features/attendance/components/StatusToggle";

export interface AttendanceRecordStatusCellProps {
  attendanceRecord: AttendanceRecord;
  editingRecord: AttendanceRecord | null;
  statuses: AttendanceStatus[];
  updateDraft: <K extends keyof AttendanceRecord>(key: K, value: AttendanceRecord[K]) => void;
}

export function AttendanceRecordStatusCell({
  attendanceRecord,
  editingRecord,
  statuses,
  updateDraft,
}: AttendanceRecordStatusCellProps): React.JSX.Element {
  if (editingRecord?.id === attendanceRecord.id) {
    return (
      <StatusToggle
        value={editingRecord.status}
        onChange={(value) => updateDraft("status", value as AttendanceRecord["status"])}
      />
    );
  }

  const info = getAttendanceStatusInfo(attendanceRecord.status, statuses);
  const config: Record<string, StatusBadgeConfigItem> = info
    ? {
        [attendanceRecord.status]: {
          label: info.label,
          cls: `${info.bg} ${info.text} ${info.border} font-semibold`,
          dot: info.dot,
        },
      }
    : {};

  return <StatusBadge status={attendanceRecord.status} config={config} size="sm" />;
}
