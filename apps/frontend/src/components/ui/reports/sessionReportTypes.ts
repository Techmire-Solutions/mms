import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { SessionsReportCapacityItem, SessionsReportTodaySession } from "@mms/shared";

export type SessionCapacityItem = SessionsReportCapacityItem;
export type CapacityChartItem = CapacityBarDatum;
export type TodaySessionItem = SessionsReportTodaySession;

export interface SessionReportFilters {
  session?: string;
  class?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  student?: string;
}

export interface SessionReportProps {
  filters: SessionReportFilters;
  onEditVisual?: (config: unknown) => void;
}

export interface EnrollmentTrendItem {
  month: string;
  students: number;
  sessionName: string | null;
}

export interface CapacityBarDatum {
  class: string;
  enrolled: number;
  available: number;
}

export interface SessionReportTableProps {
  sessionCapacityData: SessionCapacityItem[];
  sessionStatusConfig: Record<string, StatusBadgeConfigItem>;
  onToggleSessionFilter: (sessionName: string) => void;
  onToggleClassFilter: (className: string) => void;
}
