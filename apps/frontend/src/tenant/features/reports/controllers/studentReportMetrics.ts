import { TrendingUp, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StudentsCommandMetricsSnapshot } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { applyStudentsWorkDrillDown } from "@/tenant/hooks/collections/students";

export interface StudentReportMetricItem {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent: "primary" | "success" | "destructive" | "info" | "secondary";
  isActive?: boolean;
  onClick?: () => void;
}

/** Toast + route the Work directory to a status preset (Reports -> Work drill-down). */
export function applyStudentsReportDrillDown(
  t: TranslationFunction,
  status: string | undefined,
): void {
  notify.message(t("students.drillDownApplied"));
  applyStudentsWorkDrillDown(status ? { status } : {});
}

/** Builds the Students report KPI tiles (parity with Contacts tile semantics). */
export function buildStudentReportMetricItems(input: {
  t: TranslationFunction;
  metrics: StudentsCommandMetricsSnapshot | undefined;
  male: number;
  female: number;
  reportStatusFilter: string | null;
  onStatusFilterChange: (status: string | null) => void;
  onListFocus: () => void;
  onDrillDown: (status: string | undefined) => void;
}): StudentReportMetricItem[] {
  const {
    t,
    metrics,
    male,
    female,
    reportStatusFilter,
    onStatusFilterChange,
    onListFocus,
    onDrillDown,
  } = input;

  const toggleStatus = (status: string) =>
    onStatusFilterChange(reportStatusFilter === status ? null : status);

  return [
    {
      icon: Users,
      label: t("students.report.totalStudents"),
      value: metrics?.total ?? 0,
      accent: "primary",
      isActive: !reportStatusFilter,
      onClick: () => {
        onStatusFilterChange(null);
        onDrillDown(undefined);
      },
    },
    {
      icon: UserCheck,
      label: t("students.report.active"),
      value: metrics?.active ?? 0,
      accent: "success",
      isActive: reportStatusFilter === "active",
      onClick: () => {
        toggleStatus("active");
        onDrillDown("active");
      },
    },
    {
      icon: UserX,
      label: t("students.report.inactive"),
      value: metrics?.inactive ?? 0,
      accent: "destructive",
      isActive: reportStatusFilter === "inactive",
      onClick: () => {
        toggleStatus("inactive");
        onDrillDown("inactive");
      },
    },
    {
      icon: UserPlus,
      label: t("students.metrics.newThisPeriod"),
      value: metrics?.newThisPeriod ?? 0,
      accent: "secondary",
      onClick: () => onDrillDown(undefined),
    },
    {
      icon: TrendingUp,
      label: t("students.report.genderSplit"),
      value: t("students.report.genderSplitValue", { male, female }),
      accent: "info",
      onClick: onListFocus,
    },
  ];
}
