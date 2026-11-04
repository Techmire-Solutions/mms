import { useCallback, useMemo } from "react";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import type { DashboardRole } from "@/lib/dashboardRole";
import {
  useStudentsMetrics,
  useStudentsWidgetAggregates,
} from "@/tenant/hooks/collections/students";
import { useFacultyMetrics, useFacultyWidgetAggregates } from "@/tenant/hooks/collections/faculty";
import {
  useContactsMetrics,
  useContactsWidgetAggregates,
} from "@/tenant/hooks/collections/contacts";
import {
  useSessionsMetrics,
  useSessionsWidgetAggregates,
} from "@/tenant/hooks/collections/sessions";
import { useAttendanceMetrics } from "@/tenant/hooks/collections/attendance";
import { useFinanceMetrics } from "@/tenant/hooks/collections/finance";
import { useHasanatMetrics } from "@/tenant/hooks/collections/hasanat";
import { useQuestionBankMetrics } from "@/tenant/hooks/collections/questionBank";
import { useAccountingMetrics } from "@/tenant/hooks/collections/accounting";
// Own module (not `useDashboardSetupConfig`) — the summary hook is independent of the
// preferences/widgets config, and importing it from the barrel would close a cycle
// through `collections/dashboard`.
import { useDashboardSummaryQuery } from "./useDashboardSummaryQuery";
import { resolveDashboardMetricSources } from "./dashboardMetricSources";
import { selectAggregateWidgets } from "@/lib/dashboardCollections";

import {
  todayISO,
  type StudentsCommandMetricsSnapshot,
  type FacultyCommandMetricsSnapshot,
  type ContactsCommandMetricsSnapshot,
  type SessionsCommandMetricsSnapshot,
  type AttendanceCommandMetricsSnapshot,
  type FinanceCommandMetricsSnapshot,
  type HasanatCommandMetricsSnapshot,
  type QuestionBankCommandMetricsSnapshot,
  type AccountingCommandMetricsSnapshot,
  type Permission,
} from "@mms/shared";

export interface DashboardCollectionData {
  studentsTotal: number;
  facultyTotal: number;
  contactsTotal: number;
  sessionsTotal: number;
  studentMetricsInactive: number;
  studentMetricsActive: number;
  studentMetricsNew: number;
  facultyMetricsNew: number;
  contactMetricsNew: number;
  studentMetrics?: StudentsCommandMetricsSnapshot;
  facultyMetrics?: FacultyCommandMetricsSnapshot;
  contactMetrics?: ContactsCommandMetricsSnapshot;
  sessionsMetrics?: SessionsCommandMetricsSnapshot;
  attendanceMetrics?: AttendanceCommandMetricsSnapshot;
  financeMetrics?: FinanceCommandMetricsSnapshot;
  hasanatMetrics?: HasanatCommandMetricsSnapshot;
  questionBankMetrics?: QuestionBankCommandMetricsSnapshot;
  accountingMetrics?: AccountingCommandMetricsSnapshot;
  isLoading?: boolean;
  /** The composite summary request failed (individual fallbacks may still resolve). */
  summaryError?: boolean;
  /** Re-runs the composite summary request. */
  retrySummary?: () => void;
}

/** Data shape consumed by the card/trend builders (kept named for test fixtures). */
export type DashboardData = DashboardCollectionData;

/** Loads server metrics for dashboard cards — no full collection dumps for KPI values. */
export function useDashboardData(
  widgets: CustomWidget[],
  dashboardRole: DashboardRole,
  enabledModules?: Record<string, boolean | undefined>,
  can?: (permission: Permission) => boolean,
): DashboardCollectionData {
  const sources = useMemo(
    () => resolveDashboardMetricSources({ widgets, dashboardRole, enabledModules, can }),
    [widgets, dashboardRole, enabledModules, can],
  );
  // One canonical list per render: every aggregate caller must pass the same set,
  // or the content-keyed queries fan out into one request per surface.
  const aggregateWidgets = useMemo(() => selectAggregateWidgets(widgets), [widgets]);

  useContactsWidgetAggregates(aggregateWidgets, { enabled: sources.contacts });
  useStudentsWidgetAggregates(aggregateWidgets, { enabled: sources.students });
  useFacultyWidgetAggregates(aggregateWidgets, { enabled: sources.faculty });
  useSessionsWidgetAggregates(aggregateWidgets, { enabled: sources.sessions });

  const { summary, isLoading, isPending, isError, refetch } = useDashboardSummaryQuery(todayISO());
  const summaryInFlight = isLoading || isPending;
  const canFallback = !summaryInFlight;

  const { data: individualStudentMetrics } = useStudentsMetrics({
    enabled: sources.students && canFallback && !summary?.students,
  });
  const { data: individualFacultyMetrics } = useFacultyMetrics({
    enabled: sources.faculty && canFallback && !summary?.faculty,
  });
  const { data: individualContactMetrics } = useContactsMetrics({
    enabled: sources.contacts && canFallback && !summary?.contacts,
  });
  const { data: individualSessionsMetrics } = useSessionsMetrics({
    enabled: sources.sessions && canFallback && !summary?.sessions,
  });
  const { data: individualAttendanceMetrics } = useAttendanceMetrics(todayISO(), {
    enabled: sources.attendance && canFallback && !summary?.attendance,
  });
  const { data: individualFinanceMetrics } = useFinanceMetrics({
    enabled: sources.finance && canFallback && !summary?.finance,
  });
  const { data: individualHasanatMetrics } = useHasanatMetrics({
    enabled: sources.hasanat && canFallback && !summary?.hasanat,
  });
  const { data: individualQuestionBankMetrics } = useQuestionBankMetrics({
    enabled: sources.questionBank && canFallback && !summary?.questionBank,
  });
  const { data: individualAccountingMetrics } = useAccountingMetrics({
    enabled: sources.accounting && canFallback && !summary?.accounting,
  });

  const studentMetrics =
    (summary?.students as StudentsCommandMetricsSnapshot | undefined) ?? individualStudentMetrics;
  const facultyMetrics =
    (summary?.faculty as FacultyCommandMetricsSnapshot | undefined) ?? individualFacultyMetrics;
  const contactMetrics =
    (summary?.contacts as ContactsCommandMetricsSnapshot | undefined) ?? individualContactMetrics;
  const sessionsMetrics =
    (summary?.sessions as SessionsCommandMetricsSnapshot | undefined) ?? individualSessionsMetrics;
  const attendanceMetrics =
    (summary?.attendance as AttendanceCommandMetricsSnapshot | undefined) ??
    individualAttendanceMetrics;
  const financeMetrics =
    (summary?.finance as FinanceCommandMetricsSnapshot | undefined) ?? individualFinanceMetrics;
  const hasanatMetrics =
    (summary?.hasanat as HasanatCommandMetricsSnapshot | undefined) ?? individualHasanatMetrics;
  const questionBankMetrics =
    (summary?.questionBank as QuestionBankCommandMetricsSnapshot | undefined) ??
    individualQuestionBankMetrics;
  const accountingMetrics =
    (summary?.accounting as AccountingCommandMetricsSnapshot | undefined) ??
    individualAccountingMetrics;

  const retrySummary = useCallback(() => void refetch(), [refetch]);

  const studentsTotal = studentMetrics?.total ?? 0;
  const facultyTotal = facultyMetrics?.total ?? 0;
  const contactsTotal = contactMetrics?.total ?? 0;
  const sessionsTotal = sessionsMetrics?.total ?? 0;
  const isLoadingData = isLoading || isPending;

  // Stable identity so downstream card/trend memos only recompute on new data.
  return useMemo(
    () => ({
      studentsTotal,
      facultyTotal,
      contactsTotal,
      sessionsTotal,
      studentMetricsInactive: studentMetrics?.inactive ?? 0,
      studentMetricsActive: studentMetrics?.active ?? 0,
      studentMetricsNew: studentMetrics?.newThisPeriod ?? 0,
      facultyMetricsNew: facultyMetrics?.newThisPeriod ?? 0,
      contactMetricsNew: contactMetrics?.newThisPeriod ?? 0,
      studentMetrics,
      facultyMetrics,
      contactMetrics,
      sessionsMetrics,
      attendanceMetrics,
      financeMetrics,
      hasanatMetrics,
      questionBankMetrics,
      accountingMetrics,
      isLoading: isLoadingData,
      summaryError: isError,
      retrySummary,
    }),
    [
      studentsTotal,
      facultyTotal,
      contactsTotal,
      sessionsTotal,
      studentMetrics,
      facultyMetrics,
      contactMetrics,
      sessionsMetrics,
      attendanceMetrics,
      financeMetrics,
      hasanatMetrics,
      questionBankMetrics,
      accountingMetrics,
      isLoadingData,
      isError,
      retrySummary,
    ],
  );
}
