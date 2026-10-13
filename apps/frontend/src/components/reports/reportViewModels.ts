import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { ExportColumn } from "@/components/app/ExportToolbar";
import type { SubTab } from "@/components/app/SubTabBar";
import type {
  FacultyReportTablesProps,
  FacultyReportFilters,
  FacultyWorkloadItem,
} from "./facultyReportTypes";
import type { StudentReportTablesProps, StudentReportFilters } from "./studentReportTypes";

interface ReportListModel {
  t: TranslationFunction;
  listPage: number;
  setListPage: (page: number) => void;
  listTotal: number;
  listHasMore: boolean;
  listError: boolean;
  listRefetch: () => unknown;
  reportStatusFilter: string | null;
  setReportStatusFilter: (status: string | null) => void;
}

export interface FacultyReportViewModel
  extends
    ReportListModel,
    Omit<FacultyReportTablesProps, "workloadRows" | "onToggleFacultyFilter"> {
  REPORT_TABS: readonly SubTab<FacultyReportTablesProps["activeSubTab"]>[];
  setActiveSubTab: (tab: FacultyReportTablesProps["activeSubTab"]) => void;
  filters: FacultyReportFilters;
  rosterExportColumns: ExportColumn[];
  workloadExportColumns: ExportColumn[];
  resolveRosterExportRows: () => Promise<Record<string, unknown>[]>;
  facultyWorkload: FacultyWorkloadItem[];
  filteredFacultyWorkload: FacultyWorkloadItem[];
  toggleFacultyFilter: (faculty: string) => void;
}

export interface StudentReportViewModel extends ReportListModel, StudentReportTablesProps {
  REPORT_TABS: readonly SubTab<StudentReportTablesProps["activeSubTab"]>[];
  setActiveSubTab: (tab: StudentReportTablesProps["activeSubTab"]) => void;
  filters: StudentReportFilters;
  historyPage: number;
  setHistoryPage: (page: number) => void;
  historyError: boolean;
  historyTotal: number;
  historyHasMore: boolean;
  retryHistory: () => void;
  studentExportColumns: ExportColumn[];
  enrollmentExportColumns: ExportColumn[];
  resolveStudentExportRows: () => Promise<Record<string, unknown>[]>;
  resolveEnrollmentExportRows: () => Promise<Record<string, unknown>[]>;
}
