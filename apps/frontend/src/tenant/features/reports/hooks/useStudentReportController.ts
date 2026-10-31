import { useCallback, useState } from "react";
import { ENROLLMENTS_MODULE_MANIFEST, STUDENTS_MODULE_MANIFEST, type Student } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useEnrollmentsPaginated } from "@/tenant/hooks/collections/enrollments";
import {
  useStudentsMetrics,
  useStudentsWidgetAggregates,
  useStudentsContractList,
} from "@/tenant/hooks/collections/students";
import { studentStatusBadgeConfig } from "@/lib/students/studentStatusUi";
import { enrollmentStatusBadgeConfig } from "@/lib/ui/enrollmentStatusBadge";
import {
  mapEnrollmentRow,
  resolveEnrollmentReportExportRows,
  resolveStudentReportExportRows,
} from "@/tenant/features/reports/hooks/studentReportExport";
import {
  applyStudentsReportDrillDown,
  buildStudentReportMetricItems,
} from "@/tenant/features/reports/hooks/studentReportMetrics";
import type { SubTab as UINavTab } from "@/components/app/SubTabBar";
import type { ExportColumn } from "@/components/app/ExportToolbar";
import {
  type EnrollmentHistoryItem,
  mapStudentRow,
  type ReportStudent,
  type StudentReportProps,
  type StudentReportSubTab,
} from "@/components/reports/studentReportTypes";

/** Controller for Students Reports tier — Query + filters; presentational shell stays thin. */
export function useStudentReportController({ filters }: StudentReportProps) {
  const { t } = useTranslation();
  const sessions = useSessionsCollection();
  const [activeSubTab, setActiveSubTab] = useState<StudentReportSubTab>("list");
  const statusBadgeConfig = (() => studentStatusBadgeConfig(t))();
  const enrollmentStatusConfig = enrollmentStatusBadgeConfig(t);

  const REPORT_TABS = (() => [
    { key: "list", label: t("students.report.studentListTab") },
    { key: "history", label: t("students.report.enrollmentHistoryTab") },
  ])() as readonly UINavTab<StudentReportSubTab>[];
  const [listPage, setListPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [reportStatusFilter, setReportStatusFilter] = useState<string | null>(null);

  const sessionFilter = filters.session && filters.session !== "all" ? filters.session : undefined;
  const classFilter = filters.class && filters.class !== "all" ? filters.class : undefined;
  const statusParam = reportStatusFilter || (filters.status !== "all" ? filters.status : undefined);
  const searchParam = filters.student || undefined;

  // Adjust state during render: any list filter change returns the list to its first page.
  const listPageResetInputs = [
    filters.student,
    filters.status,
    filters.session,
    filters.class,
    reportStatusFilter,
  ];
  const [prevListPageResetInputs, setPrevListPageResetInputs] = useState(listPageResetInputs);
  if (prevListPageResetInputs.some((value, index) => value !== listPageResetInputs[index])) {
    setPrevListPageResetInputs(listPageResetInputs);
    setListPage(1);
  }

  // Adjust state during render: student/session changes return enrollment history to page one.
  const historyPageResetInputs = [filters.student, filters.session];
  const [prevHistoryPageResetInputs, setPrevHistoryPageResetInputs] =
    useState(historyPageResetInputs);
  if (prevHistoryPageResetInputs.some((value, index) => value !== historyPageResetInputs[index])) {
    setPrevHistoryPageResetInputs(historyPageResetInputs);
    setHistoryPage(1);
  }

  const { data: metrics, isLoading: metricsLoading } = useStudentsMetrics();
  const { data: genderAggregates } = useStudentsWidgetAggregates([
    {
      id: "male",
      collection: "students",
      operation: "count",
      filterField: "gender",
      filterOperator: "equals",
      filterValue: "male",
    },
    {
      id: "female",
      collection: "students",
      operation: "count",
      filterField: "gender",
      filterOperator: "equals",
      filterValue: "female",
    },
  ]);

  const studentsPageQuery = useStudentsContractList(
    {
      page: listPage,
      limit: STUDENTS_MODULE_MANIFEST.defaultPageSize,
      search: searchParam,
      status: statusParam,
      sessionId: sessionFilter,
      className: classFilter,
    },
    activeSubTab === "list",
  );

  const enrollmentsPageQuery = useEnrollmentsPaginated({
    page: historyPage,
    limit: ENROLLMENTS_MODULE_MANIFEST.defaultPageSize,
    search: searchParam,
    sessionId: sessionFilter,
    enabled: activeSubTab === "history",
  });

  const listError = studentsPageQuery.isError;
  const listLoading = studentsPageQuery.isLoading;
  const listRefetch = studentsPageQuery.refetch;
  const historyError = enrollmentsPageQuery.isError;
  const historyLoading = enrollmentsPageQuery.isLoading;

  const students = (() => {
    const studentRows = studentsPageQuery.data?.body?.students ?? [];
    return studentRows.map((student: Student) => mapStudentRow(student, sessions));
  })() as ReportStudent[];

  const listTotal = studentsPageQuery.data?.body?.total ?? 0;
  const listHasMore = Boolean(studentsPageQuery.data?.body?.hasMore);

  const enrollments = (() =>
    (enrollmentsPageQuery.data?.enrollments ?? []).map(
      mapEnrollmentRow,
    ))() as EnrollmentHistoryItem[];

  const male = genderAggregates?.male?.value ?? 0;
  const female = genderAggregates?.female?.value ?? 0;

  const studentExportColumns = (() => [
    { header: t("students.report.colName"), key: "name" },
    { header: t("students.report.colGender"), key: "gender" },
    { header: t("students.report.colClass"), key: "class" },
    { header: t("students.report.colSession"), key: "session" },
    { header: t("students.report.colCity"), key: "city" },
    { header: t("students.report.colAge"), key: "age" },
    { header: t("students.report.colRegistered"), key: "registered" },
    { header: t("students.report.colStatus"), key: "status" },
  ])() as ExportColumn[];

  const enrollmentExportColumns = (() => [
    { header: t("students.report.colStudent"), key: "studentName" },
    { header: t("students.report.colSession"), key: "session" },
    { header: t("students.report.colClass"), key: "class" },
    { header: t("students.report.colEnrolled"), key: "enrolled" },
    { header: t("students.report.colStatus"), key: "status" },
  ])() as ExportColumn[];

  const resolveStudentExportRows = () =>
    resolveStudentReportExportRows({
      search: searchParam,
      status: statusParam,
      sessionId: sessionFilter,
      className: classFilter,
      sessions,
    });

  const resolveEnrollmentExportRows = () =>
    resolveEnrollmentReportExportRows({ search: searchParam, sessionId: sessionFilter });

  const drillDownToWork = useCallback(
    (status: string | undefined) => applyStudentsReportDrillDown(t, status),
    [t],
  );

  const metricItems = (() =>
    buildStudentReportMetricItems({
      t,
      metrics,
      male,
      female,
      reportStatusFilter,
      onStatusFilterChange: setReportStatusFilter,
      onListFocus: () => setActiveSubTab("list"),
      onDrillDown: drillDownToWork,
    }))();

  return {
    t,
    activeSubTab,
    setActiveSubTab,
    REPORT_TABS,
    statusBadgeConfig,
    enrollmentStatusConfig,
    listPage,
    setListPage,
    historyPage,
    setHistoryPage,
    reportStatusFilter,
    setReportStatusFilter,
    listError,
    listLoading,
    historyError,
    historyLoading,
    listRefetch,
    enrollmentsPageQuery,
    students,
    enrollments,
    listTotal,
    listHasMore,
    studentExportColumns,
    enrollmentExportColumns,
    resolveStudentExportRows,
    resolveEnrollmentExportRows,
    metricItems,
    metrics,
    metricsLoading,
    filters,
  };
}
