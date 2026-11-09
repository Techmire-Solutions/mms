import {
  type AttendanceSettings,
  type AttendanceRecord,
  type AttendanceStatus,
  DEFAULT_ATTENDANCE_SETTINGS as DEFAULT_ATT_SETTINGS,
  DEFAULT_ATTENDANCE_STATUSES,
  toTitleCase,
} from "@mms/shared";

export type { AttendanceSettings, AttendanceRecord, AttendanceStatus };
export { DEFAULT_ATT_SETTINGS };
/**
 * The status display model is **shared** (`packages/shared/attendanceLookupTypes`). This module used
 * to re-declare an identical array plus its own `AttendanceStatus` type and a positional `STATUS_MAP`
 * — three ways for the same mapping to drift from the enum.
 */
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = DEFAULT_ATTENDANCE_STATUSES;

/** Roster entry the marking grid consumes (a student projected into one class). */
export interface ClassStudent {
  id: string;
  name: string;
  rollNo: string;
  gender?: string;
  sectionId?: string | null;
}

export function getAttendanceStatusInfo(
  status: string,
  customStatuses?: AttendanceStatus[],
): AttendanceStatus {
  const statusList: readonly AttendanceStatus[] =
    customStatuses && customStatuses.length > 0 ? customStatuses : DEFAULT_ATTENDANCE_STATUSES;
  const found = statusList.find((statusOption) => statusOption.id === status);
  if (found) return found;
  return {
    // Unknown ids still render (legacy rows); the shared model governs known statuses.
    id: status as AttendanceStatus["id"],
    label: toTitleCase(status),
    short: status.charAt(0).toUpperCase(),
    color: "muted",
    bg: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    border: "border-border",
    dot: "bg-muted-foreground",
  };
}

export const CLASS_STUDENTS: Record<string, ClassStudent[]> = {};

export function calcClassStats(classId: string, records: AttendanceRecord[]) {
  const classRecords = records.filter((record) => record.classId === classId);
  const counts: Record<string, number> = {};
  classRecords.forEach((record) => {
    counts[record.status] = (counts[record.status] || 0) + 1;
  });
  const total = classRecords.length;
  // `half_day` credits attendance once, same as late (shared `ATTENDANCE_ATTENDED_STATUSES`).
  const present = counts.present || 0;
  const late = counts.late || 0;
  const halfDay = counts.half_day || 0;
  const rate = total ? Math.round(((present + late + halfDay) / total) * 100) : 0;
  return { ...counts, rate };
}

export function calcStudentRate(studentId: string, records: AttendanceRecord[]): number {
  const studentRecords = records.filter((record) => record.studentId === studentId);
  const present = studentRecords.filter(
    (record) => record.status === "present" || record.status === "late",
  ).length;
  const total = studentRecords.length;
  return total ? Math.round((present / total) * 100) : 100;
}

export function getMonthlyTrend(
  classId: string,
  records: AttendanceRecord[],
): { month: string; rate: number }[] {
  const classRecords = records.filter((record) => record.classId === classId);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const grouped: Record<string, { present: number; total: number }> = {};
  classRecords.forEach((record) => {
    if (!record.date) return;
    const dateObj = new Date(record.date);
    const month = months[dateObj.getMonth()];
    if (!grouped[month]) grouped[month] = { present: 0, total: 0 };
    grouped[month].total++;
    if (record.status === "present" || record.status === "late") {
      grouped[month].present++;
    }
  });
  return months.flatMap((month) => {
    const monthStats = grouped[month];
    return monthStats && monthStats.total
      ? [
          {
            month,
            rate: Math.round((monthStats.present / monthStats.total) * 100),
          },
        ]
      : [];
  });
}
