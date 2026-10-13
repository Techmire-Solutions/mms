import { UserCheck, UserMinus, UserPlus, UserX, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FacultyCommandMetricsSnapshot, FacultyQuickFilter } from "@mms/shared";
import { resolveFacultyStatusRoles } from "@mms/shared";
import type { AccentColor } from "@/components/ui/statCardAccent";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { applyFacultyWorkDrillDown } from "@/tenant/hooks/collections/faculty";
import { resolveClassFacultyId, resolveClassFacultyName } from "@/lib/faculty/facultyAssignment";
import type { FacultyWorkloadItem } from "@/components/ui/reports/facultyReportTypes";

export interface FacultyReportMetricItem {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent: AccentColor;
  isActive?: boolean;
  onClick?: () => void;
}

/** Toast + route the Work directory to a status preset (Reports -> Work drill-down). */
export function applyFacultyReportDrillDown(
  t: TranslationFunction,
  quickFilter: FacultyQuickFilter | undefined,
): void {
  notify.message(t("faculty.drillDownApplied"));
  applyFacultyWorkDrillDown(quickFilter ? { quickFilter } : {});
}

/** Builds the Faculty report KPI tiles (parity with Students tile semantics). */
export function buildFacultyReportMetricItems(input: {
  t: TranslationFunction;
  metrics: FacultyCommandMetricsSnapshot | undefined;
  reportStatusFilter: string | null;
  onStatusFilterChange: (status: string | null) => void;
  onDrillDown: (quickFilter: FacultyQuickFilter | undefined) => void;
}): FacultyReportMetricItem[] {
  const { t, metrics, reportStatusFilter, onStatusFilterChange, onDrillDown } = input;
  const {
    active: activeStatus,
    inactive: inactiveStatus,
    onLeave: onLeaveStatus,
  } = resolveFacultyStatusRoles();

  const toggleStatus = (status: string): void =>
    onStatusFilterChange(reportStatusFilter === status ? null : status);

  return [
    {
      icon: Users,
      label: t("faculty.report.totalFaculty"),
      value: metrics?.total ?? 0,
      accent: "primary",
      isActive: !reportStatusFilter,
      onClick: () => {
        onStatusFilterChange(null);
        onDrillDown("all");
      },
    },
    {
      icon: UserCheck,
      label: t("faculty.metrics.active"),
      value: metrics?.active ?? 0,
      accent: "success",
      isActive: reportStatusFilter === activeStatus,
      onClick: () => {
        toggleStatus(activeStatus);
        onDrillDown("active");
      },
    },
    {
      icon: UserX,
      label: t("faculty.metrics.inactive"),
      value: metrics?.inactive ?? 0,
      accent: "destructive",
      isActive: reportStatusFilter === inactiveStatus,
      onClick: () => {
        toggleStatus(inactiveStatus);
        onDrillDown("inactive");
      },
    },
    {
      icon: UserMinus,
      label: t("faculty.metrics.onLeave"),
      value: metrics?.onLeave ?? 0,
      accent: "warning",
      isActive: reportStatusFilter === onLeaveStatus,
      onClick: () => {
        toggleStatus(onLeaveStatus);
        onDrillDown("onLeave");
      },
    },
    {
      icon: UserPlus,
      label: t("faculty.metrics.newThisPeriod"),
      value: metrics?.newThisPeriod ?? 0,
      accent: "secondary",
      onClick: () => onDrillDown(undefined),
    },
  ];
}

/** Aggregates class & session workload counts per faculty member across active sessions. */
export function computeFacultyWorkload(
  filteredSessions: Array<{
    id: string;
    classes?: Array<{
      id: string;
      enrolled: number;
      facultyId?: string;
      facultyName?: string;
      [key: string]: unknown;
    }>;
  }>,
  resolveClassFaculty: (facultyId: string, facultyName: string) => string,
): FacultyWorkloadItem[] {
  const workloadByFacultyName: Record<
    string,
    { classes: Set<string>; sessions: Set<string>; students: number }
  > = {};
  filteredSessions.forEach((session) => {
    (session.classes || []).forEach((sessionClass) => {
      const facultyName = resolveClassFaculty(
        resolveClassFacultyId(sessionClass),
        resolveClassFacultyName(sessionClass),
      );
      if (!workloadByFacultyName[facultyName]) {
        workloadByFacultyName[facultyName] = {
          classes: new Set(),
          sessions: new Set(),
          students: 0,
        };
      }
      workloadByFacultyName[facultyName].classes.add(sessionClass.id);
      workloadByFacultyName[facultyName].sessions.add(session.id);
      workloadByFacultyName[facultyName].students += sessionClass.enrolled;
    });
  });

  return Object.entries(workloadByFacultyName)
    .map(([faculty, workload]) => ({
      faculty,
      classes: workload.classes.size,
      sessions: workload.sessions.size,
      totalStudents: workload.students,
    }))
    .sort(
      (firstFaculty, secondFaculty) => secondFaculty.totalStudents - firstFaculty.totalStudents,
    );
}

/** Summarizes total faculty, students, classes, and average students per faculty. */
export function summarizeFacultyWorkload(
  workload: Array<{ classes: number; totalStudents: number }>,
) {
  const totalFaculty = workload.length;
  const totalStudents = workload.reduce((total, faculty) => total + faculty.totalStudents, 0);
  const totalClasses = workload.reduce((total, faculty) => total + faculty.classes, 0);
  const avgStudents = totalFaculty ? (totalStudents / totalFaculty).toFixed(1) : 0;
  return { totalFaculty, totalStudents, totalClasses, avgStudents };
}
