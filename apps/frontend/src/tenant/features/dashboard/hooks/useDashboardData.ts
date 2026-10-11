import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import {
  isDashboardAdmin,
  isDashboardAdminOrAccountant,
  isDashboardFaculty,
  type DashboardRole,
} from "@/lib/dashboardRole";
import {
  getRequiredDashboardCollections,
  filterDashboardWidgetsByCollection,
  isWidgetActiveForDashboard,
  DASHBOARD_ACCOUNTING_WIDGET_IDS,
} from "@/lib/dashboardCollections";
import { isSeededDashboardWidget } from "@/lib/dashboardWidgets";
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
import { useDashboardSummaryQuery } from "@/tenant/hooks/collections/dashboard";

import {
  todayISO,
  ACCOUNTING_MODULE_MANIFEST,
  getModuleActionPermission,
  resolveAccessModuleId,
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
}

function needsWidgetAggregate(widget: CustomWidget): boolean {
  return widget.widgetType !== "card" || !isSeededDashboardWidget(widget.id);
}

/** Loads server metrics for dashboard cards — no full collection dumps for KPI values. */
export function useDashboardData(
  widgets: CustomWidget[],
  dashboardRole: DashboardRole,
  enabledModules?: Record<string, boolean | undefined>,
  can?: (permission: Permission) => boolean,
): DashboardCollectionData {
  const isModuleEnabled = (mod: string) => !enabledModules || enabledModules[mod] !== false;
  // Same read permission the backend module gate enforces (shared policy).
  const canReadModule = (mod: string) => {
    const moduleId = resolveAccessModuleId(mod);
    return (
      isModuleEnabled(mod) &&
      (!can || (moduleId !== undefined && can(getModuleActionPermission(moduleId, "read"))))
    );
  };

  const requiredDashboardCollections = (() =>
    getRequiredDashboardCollections(widgets, dashboardRole, enabledModules, can))();

  const shouldLoadContacts =
    requiredDashboardCollections.has("contacts") && canReadModule("contacts");
  const shouldLoadStudents =
    (requiredDashboardCollections.has("students") || isDashboardAdmin(dashboardRole)) &&
    canReadModule("students");
  const shouldLoadFaculty = requiredDashboardCollections.has("faculty") && canReadModule("faculty");
  // Role shell needs: faculty banner (sessions), admin/accountant notifications (finance + attendance).
  const shouldLoadSessions =
    (requiredDashboardCollections.has("sessions") || isDashboardFaculty(dashboardRole)) &&
    canReadModule("sessions");
  const shouldLoadAttendance =
    (requiredDashboardCollections.has("attendance_records") ||
      isDashboardAdminOrAccountant(dashboardRole) ||
      isDashboardFaculty(dashboardRole)) &&
    canReadModule("attendance");
  const shouldLoadFinance =
    (requiredDashboardCollections.has("finance_invoices") ||
      isDashboardAdminOrAccountant(dashboardRole)) &&
    canReadModule("finance");
  const shouldLoadHasanat =
    requiredDashboardCollections.has("hasanat_distributions") && canReadModule("hasanat");
  const shouldLoadQuestionBank =
    (requiredDashboardCollections.has("questions") ||
      requiredDashboardCollections.has("tests") ||
      requiredDashboardCollections.has("assessment_results")) &&
    canReadModule("questionBank");
  const shouldLoadAccounting =
    canReadModule("accounting") &&
    widgets.some(
      (w) =>
        isWidgetActiveForDashboard(w, dashboardRole) &&
        (w.category === ACCOUNTING_MODULE_MANIFEST.moduleId ||
          DASHBOARD_ACCOUNTING_WIDGET_IDS.has(w.id)),
    );

  const collectionWidgets = {
    contacts: filterDashboardWidgetsByCollection(widgets, "contacts", dashboardRole).filter(
      needsWidgetAggregate,
    ),
    students: filterDashboardWidgetsByCollection(widgets, "students", dashboardRole).filter(
      needsWidgetAggregate,
    ),
    faculty: filterDashboardWidgetsByCollection(widgets, "faculty", dashboardRole).filter(
      needsWidgetAggregate,
    ),
    sessions: filterDashboardWidgetsByCollection(widgets, "sessions", dashboardRole).filter(
      needsWidgetAggregate,
    ),
  };

  useContactsWidgetAggregates(collectionWidgets.contacts, { enabled: shouldLoadContacts });
  useStudentsWidgetAggregates(collectionWidgets.students, { enabled: shouldLoadStudents });
  useFacultyWidgetAggregates(collectionWidgets.faculty, { enabled: shouldLoadFaculty });
  useSessionsWidgetAggregates(collectionWidgets.sessions, { enabled: shouldLoadSessions });

  const { summary, isLoading, isPending } = useDashboardSummaryQuery(todayISO(), dashboardRole);
  const summaryInFlight = isLoading || isPending;
  const canFallback = !summaryInFlight;

  const { data: individualStudentMetrics } = useStudentsMetrics({
    enabled: shouldLoadStudents && canFallback && !summary?.students,
  });
  const { data: individualFacultyMetrics } = useFacultyMetrics({
    enabled: shouldLoadFaculty && canFallback && !summary?.faculty,
  });
  const { data: individualContactMetrics } = useContactsMetrics({
    enabled: shouldLoadContacts && canFallback && !summary?.contacts,
  });
  const { data: individualSessionsMetrics } = useSessionsMetrics({
    enabled: shouldLoadSessions && canFallback && !summary?.sessions,
  });
  const { data: individualAttendanceMetrics } = useAttendanceMetrics(todayISO(), {
    enabled: shouldLoadAttendance && canFallback && !summary?.attendance,
  });
  const { data: individualFinanceMetrics } = useFinanceMetrics({
    enabled: shouldLoadFinance && canFallback && !summary?.finance,
  });
  const { data: individualHasanatMetrics } = useHasanatMetrics({
    enabled: shouldLoadHasanat && canFallback && !summary?.hasanat,
  });
  const { data: individualQuestionBankMetrics } = useQuestionBankMetrics({
    enabled: shouldLoadQuestionBank && canFallback && !summary?.questionBank,
  });
  const { data: individualAccountingMetrics } = useAccountingMetrics({
    enabled: shouldLoadAccounting && canFallback && !summary?.accounting,
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

  const studentsTotal = studentMetrics?.total ?? 0;
  const facultyTotal = facultyMetrics?.total ?? 0;
  const contactsTotal = contactMetrics?.total ?? 0;
  const sessionsTotal = sessionsMetrics?.total ?? 0;

  return {
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
    isLoading: isLoading || isPending,
  };
}
