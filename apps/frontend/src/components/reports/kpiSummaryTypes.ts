import type { LucideIcon } from "lucide-react";
import type {
  ContactsReportAnalyticsSnapshot,
  StudentsCommandMetricsSnapshot,
  FacultyCommandMetricsSnapshot,
} from "@mms/shared";

export interface KPIItem {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  color:
    | "primary"
    | "success"
    | "info"
    | "warning"
    | "destructive"
    | "secondary"
    | "muted"
    | "green"
    | "blue"
    | "red"
    | "amber"
    | "violet";
  trend: "up" | "down" | "flat";
  velocity?: string;
  isAvailable: boolean;
}

export interface CategorizedKPIItem extends KPIItem {
  categories: string[];
}

export interface KPISummaryProps {
  category: string;
  role?: string;
}

export type ContactKPIAnalytics = ContactsReportAnalyticsSnapshot;
export type EntityKPIMetrics = StudentsCommandMetricsSnapshot;
export type FacultyKPIMetrics = FacultyCommandMetricsSnapshot;

export interface AggregateCardValue {
  value: number;
  totalCount: number;
}
