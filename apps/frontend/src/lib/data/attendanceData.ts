import {
  type AttendanceSettings,
  type AttendanceRecord,
  DEFAULT_ATTENDANCE_SETTINGS as DEFAULT_ATT_SETTINGS,
  toTitleCase,
} from "@mms/shared";

export type { AttendanceSettings, AttendanceRecord };
export { DEFAULT_ATT_SETTINGS };

export const ATTENDANCE_STATUSES = [
  {
    id: "present",
    label: "Present",
    short: "P",
    color: "emerald",
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/30",
    dot: "bg-success",
  },
  {
    id: "absent",
    label: "Absent",
    short: "A",
    color: "red",
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
    dot: "bg-destructive",
  },
  {
    id: "late",
    label: "Late",
    short: "L",
    color: "amber",
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/30",
    dot: "bg-warning",
  },
  {
    id: "excused",
    label: "Excused",
    short: "E",
    color: "blue",
    bg: "bg-info/10",
    text: "text-info",
    border: "border-info/30",
    dot: "bg-info",
  },
];

export interface ClassStudent {
  id: string;
  name: string;
  gender: "male" | "female";
  rollNo: string;
}

export type AttendanceStatus = {
  id: string;
  label: string;
  short: string;
  color: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
};

export function getAttendanceStatusInfo(
  status: string,
  customStatuses?: AttendanceStatus[],
): AttendanceStatus {
  const statusList =
    customStatuses && customStatuses.length > 0 ? customStatuses : ATTENDANCE_STATUSES;
  const found = statusList.find((statusOption) => statusOption.id === status);
  if (found) return found;
  return {
    id: status,
    label: toTitleCase(status),
    short: status.charAt(0).toUpperCase(),
    color: "muted",
    bg: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    border: "border-border",
    dot: "bg-muted-foreground",
  };
}

export const STATUS_MAP: Record<string, AttendanceStatus> = {
  present: ATTENDANCE_STATUSES[0] as AttendanceStatus,
  absent: ATTENDANCE_STATUSES[1] as AttendanceStatus,
  late: ATTENDANCE_STATUSES[2] as AttendanceStatus,
  excused: ATTENDANCE_STATUSES[3] as AttendanceStatus,
};

export const CLASS_STUDENTS: Record<string, ClassStudent[]> = {};

export function calcClassStats(classId: string, records: AttendanceRecord[]) {
  const classRecords = records.filter((record) => record.classId === classId);
  const counts: Record<string, number> = {};
  classRecords.forEach((record) => {
    counts[record.status] = (counts[record.status] || 0) + 1;
  });
  const total = classRecords.length;
  const present = counts.present || 0;
  const late = counts.late || 0;
  const rate = total ? Math.round(((present + late) / total) * 100) : 0;
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
