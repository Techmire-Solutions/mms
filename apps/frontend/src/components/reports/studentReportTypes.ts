import { calcAge, formatDate, type Session, type Student, type StudentRecord } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

export type StudentReportSubTab = "list" | "history";

export interface ReportStudent {
  id: string;
  name: string;
  gender: string;
  status: string;
  session: string;
  class: string;
  city: string;
  registered: string;
  age: number;
}

export interface EnrollmentHistoryItem {
  id: string;
  studentName: string;
  session: string;
  class: string;
  enrolled: string;
  status: string;
}

export interface StudentReportFilters {
  status: string;
  class: string;
  student: string;
  session?: string;
}

export interface StudentReportProps {
  filters: StudentReportFilters;
  onEditVisual?: (config: unknown) => void;
}

export interface StudentReportTablesProps {
  activeSubTab: StudentReportSubTab;
  students: ReportStudent[];
  enrollments: EnrollmentHistoryItem[];
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
  enrollmentStatusConfig: Record<string, StatusBadgeConfigItem>;
  listLoading?: boolean;
  historyLoading?: boolean;
}

export function resolveStudentSessionLabels(
  student: Student | StudentRecord,
  sessions: Session[],
): { sessionLabel: string; classLabel: string } {
  const rawSessions = (student as { enrolledSessions?: unknown }).enrolledSessions;
  const enrolledIds = Array.isArray(rawSessions) ? (rawSessions as string[]) : [];
  const enrolledIdSet = new Set(enrolledIds);
  const matchedSessions = sessions.filter((session) => enrolledIdSet.has(session.id));
  const sessionLabel =
    matchedSessions
      .map((session) => session.name)
      .filter(Boolean)
      .join(", ") || "—";
  const classNames = new Set<string>();
  for (const session of matchedSessions) {
    for (const sessionClass of session.classes ?? []) {
      if (sessionClass.name) classNames.add(sessionClass.name);
    }
  }
  const classLabel = [...classNames].join(", ") || "—";
  return { sessionLabel, classLabel };
}

export function mapStudentRow(
  student: Student | StudentRecord,
  sessions: Session[] = [],
): ReportStudent {
  const age = calcAge(student.dob) ?? 0;
  const { sessionLabel, classLabel } = resolveStudentSessionLabels(student, sessions);
  const registeredDate = (student as { registeredDate?: string }).registeredDate;
  return {
    id: String(student.id),
    name: student.name || "",
    gender: student.gender || "",
    status: student.status || "inactive",
    session: sessionLabel,
    class: classLabel,
    city: student.city || "—",
    registered: registeredDate ? formatDate(registeredDate, true) : "—",
    age,
  };
}
