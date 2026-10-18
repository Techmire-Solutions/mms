import React from "react";
import {
  ClipboardList,
  Filter,
  UserCheck,
  UserX,
  Clock,
  CalendarClock,
  CalendarDays,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAttendanceMetrics } from "@/tenant/features/attendance/hooks/useAttendance";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";

export interface AttendanceCommandMetricsProps {
  total: number;
  shown: number;
  selectedDate: string;
}

export const AttendanceCommandMetrics = function AttendanceCommandMetrics({
  total,
  shown,
  selectedDate,
}: AttendanceCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics } = useAttendanceMetrics(selectedDate);

  const metrics = (() => ({
    total: serverMetrics?.total ?? total,
    selectedDatePresent: serverMetrics?.selectedDatePresent ?? 0,
    selectedDateAbsent: serverMetrics?.selectedDateAbsent ?? 0,
    selectedDateLate: serverMetrics?.selectedDateLate ?? 0,
    selectedDateExcused: serverMetrics?.selectedDateExcused ?? 0,
    periodTotal: serverMetrics?.periodTotal ?? 0,
  }))();

  const items = (() => [
    {
      icon: ClipboardList,
      label: t("attendance.metrics.total"),
      value: metrics.total,
      accent: "primary" as const,
    },
    {
      icon: Filter,
      label: t("attendance.metrics.filtered"),
      value: shown,
      accent: "info" as const,
    },
    {
      icon: UserCheck,
      label: t("attendance.metrics.present"),
      value: metrics.selectedDatePresent,
      accent: "success" as const,
    },
    {
      icon: UserX,
      label: t("attendance.metrics.absent"),
      value: metrics.selectedDateAbsent,
      accent: "destructive" as const,
    },
    {
      icon: Clock,
      label: t("attendance.metrics.late"),
      value: metrics.selectedDateLate,
      accent: "warning" as const,
    },
    {
      icon: CalendarClock,
      label: t("attendance.metrics.excused"),
      value: metrics.selectedDateExcused,
      accent: "indigo" as const,
    },
    {
      icon: CalendarDays,
      label: t("attendance.metrics.periodTotal"),
      value: metrics.periodTotal,
      accent: "purple" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
