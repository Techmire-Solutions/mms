import { formatDate, type FacultyMember } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";

export type FacultyReportSubTab = "roster" | "workload";

export interface ReportFaculty extends Record<string, unknown> {
  id: string;
  name: string;
  employeeId: string;
  specialization: string;
  status: string;
  qualification: string;
  joinDate: string;
  gender: string;
}

export interface FacultyWorkloadItem extends Record<string, unknown> {
  faculty: string;
  classes: number;
  sessions: number;
  totalStudents: number;
}

export interface FacultyReportFilters {
  status: string;
  class: string;
  student: string;
  session?: string;
}

export interface FacultyReportProps {
  filters: FacultyReportFilters;
  onEditVisual?: (config: unknown) => void;
}

export interface FacultyReportTablesProps {
  activeSubTab: FacultyReportSubTab;
  faculty: ReportFaculty[];
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
  listLoading?: boolean;
  workloadRows: FacultyWorkloadItem[];
  selectedFaculty: string | null;
  onToggleFacultyFilter: (faculty: string) => void;
}

/** Maps a hydrated FacultyMember to the roster report row shape. */
export function mapFacultyRow(member: FacultyMember): ReportFaculty {
  return {
    id: String(member.id),
    name: member.name || "",
    employeeId: member.employeeId || "—",
    specialization: member.specialization || "—",
    status: member.status || "inactive",
    qualification: member.qualification || "—",
    joinDate: member.joinDate ? formatDate(member.joinDate, true) : "—",
    gender: member.gender || "—",
  };
}
