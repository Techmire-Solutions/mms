import { useCallback, useEffect, useMemo, useState } from "react";
import { FACULTY_MODULE_MANIFEST, type Faculty, type FacultyQuickFilter } from "@mms/shared";
import { BookOpen, Layers, Users } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import {
  useFacultyByIds,
  useFacultyMetrics,
  useFacultyContractList,
} from "@/tenant/hooks/collections/faculty";
import { facultyStatusBadgeConfig } from "@/lib/faculty/facultyStatusUi";
import { collectFacultyIdsFromSessions } from "@/lib/registryResolve";
import { facultyNameById } from "@/lib/faculty/facultyAssignment";
import {
  applyFacultyReportDrillDown,
  buildFacultyReportMetricItems,
  computeFacultyWorkload,
  summarizeFacultyWorkload,
} from "@/tenant/features/reports/hooks/facultyReportMetrics";
import { resolveFacultyReportExportRows } from "@/tenant/features/reports/hooks/facultyReportExport";
import type { ExportColumn } from "@/components/app/ExportToolbar";
import {
  mapFacultyRow,
  type FacultyReportProps,
  type FacultyReportSubTab,
} from "@/components/reports/facultyReportTypes";
import type { SubTab as UINavTab } from "@/components/app/SubTabBar";

/** Controller for Faculty Reports tier — Query + filters; presentational shell stays thin. */
export function useFacultyReportController({ filters }: FacultyReportProps) {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<FacultyReportSubTab>("roster");
  const statusBadgeConfig = (() => facultyStatusBadgeConfig(t))();

  const REPORT_TABS = (() => [
    { key: "roster", label: t("faculty.report.rosterTab") },
    { key: "workload", label: t("faculty.report.workloadTab") },
  ])() as readonly UINavTab<FacultyReportSubTab>[];

  const [listPage, setListPage] = useState(1);
  const [reportStatusFilter, setReportStatusFilter] = useState<string | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);

  const sessionFilter = filters.session && filters.session !== "all" ? filters.session : undefined;
  const classFilter = filters.class && filters.class !== "all" ? filters.class : undefined;
  const statusParam = reportStatusFilter || (filters.status !== "all" ? filters.status : undefined);
  const searchParam = filters.student || undefined;

  useEffect(() => {
    setListPage(1);
  }, [filters.student, filters.status, reportStatusFilter]);

  const { data: metrics, isLoading: metricsLoading } = useFacultyMetrics();

  const rosterQuery = useFacultyContractList(
    {
      page: listPage,
      limit: FACULTY_MODULE_MANIFEST.defaultPageSize,
      search: searchParam,
      status: statusParam,
    },
    activeSubTab === "roster",
  );

  const listError = rosterQuery.isError;
  const listLoading = rosterQuery.isLoading;
  const listRefetch = rosterQuery.refetch;

  const rawList = rosterQuery.data?.body as { faculty?: Faculty[] } | undefined;
  const list = rawList?.faculty ?? [];
  const faculty = list.map(mapFacultyRow);

  const listTotal = rosterQuery.data?.body?.total ?? 0;
  const listHasMore = Boolean(rosterQuery.data?.body?.hasMore);

  const sessions = useSessionsCollection();
  const facultyIds = (() => collectFacultyIdsFromSessions(sessions))();
  const { data: workloadFaculty = [] } = useFacultyByIds(facultyIds);

  const filteredSessions = (() => {
    if (!sessionFilter && !classFilter) return sessions;
    return sessions.filter((session) => {
      if (sessionFilter && session.id !== sessionFilter) return false;
      if (classFilter) {
        const hasClass = (session.classes ?? []).some(
          (sessionClass) => sessionClass.name === classFilter,
        );
        if (!hasClass) return false;
      }
      return true;
    });
  })();

  const resolveClassFacultyMember = useCallback(
    (facultyId: string, facultyName: string): string => {
      const fromRegistry = facultyNameById(workloadFaculty, facultyId);
      return fromRegistry || facultyName || t("faculty.report.unassigned");
    },
    [workloadFaculty, t],
  );

  const facultyWorkload = useMemo(
    () => computeFacultyWorkload(filteredSessions, resolveClassFacultyMember),
    [filteredSessions, resolveClassFacultyMember],
  );

  const { totalStudents, totalClasses, avgStudents } = summarizeFacultyWorkload(facultyWorkload);

  const filteredFacultyWorkload = (() =>
    selectedFaculty
      ? facultyWorkload.filter((facultyItem) => facultyItem.faculty === selectedFaculty)
      : facultyWorkload)();

  const toggleFacultyFilter = (faculty: string): void => {
    setSelectedFaculty((current) => (current === faculty ? null : faculty));
  };

  const rosterExportColumns = (() => [
    { header: t("faculty.report.colName"), key: "name" },
    { header: t("faculty.report.colEmployeeId"), key: "employeeId" },
    { header: t("faculty.report.colSpecialization"), key: "specialization" },
    { header: t("faculty.report.colStatus"), key: "status" },
    { header: t("faculty.report.colQualification"), key: "qualification" },
    { header: t("faculty.report.colJoinDate"), key: "joinDate" },
    { header: t("faculty.report.colGender"), key: "gender" },
  ])() as ExportColumn[];

  const workloadExportColumns = (() => [
    { header: t("faculty.report.colFaculty"), key: "faculty" },
    { header: t("faculty.report.colClasses"), key: "classes" },
    { header: t("faculty.report.colSessions"), key: "sessions" },
    { header: t("faculty.report.colStudents"), key: "totalStudents" },
  ])() as ExportColumn[];

  const resolveRosterExportRows = (): Promise<Record<string, unknown>[]> =>
    resolveFacultyReportExportRows({ search: searchParam, status: statusParam });

  const drillDownToWork = useCallback(
    (quickFilter: FacultyQuickFilter | undefined) => applyFacultyReportDrillDown(t, quickFilter),
    [t],
  );

  const metricItems = (() => [
    ...buildFacultyReportMetricItems({
      t,
      metrics,
      reportStatusFilter,
      onStatusFilterChange: setReportStatusFilter,
      onDrillDown: drillDownToWork,
    }),
    { icon: Users, label: t("faculty.report.totalStudents"), value: totalStudents, accent: "info" },
    {
      icon: Layers,
      label: t("faculty.report.totalClasses"),
      value: totalClasses,
      accent: "secondary",
    },
    {
      icon: BookOpen,
      label: t("faculty.report.avgStudentsFaculty"),
      value: avgStudents,
      accent: "success",
    },
  ])();

  return {
    t,
    activeSubTab,
    setActiveSubTab,
    REPORT_TABS,
    statusBadgeConfig,
    listPage,
    setListPage,
    reportStatusFilter,
    setReportStatusFilter,
    listError,
    listLoading,
    listRefetch,
    rosterQuery,
    faculty,
    listTotal,
    listHasMore,
    rosterExportColumns,
    workloadExportColumns,
    resolveRosterExportRows,
    metricItems,
    metrics,
    metricsLoading,
    facultyWorkload,
    filteredFacultyWorkload,
    selectedFaculty,
    toggleFacultyFilter,
    totalStudents,
    totalClasses,
    avgStudents,
    filters,
  };
}
