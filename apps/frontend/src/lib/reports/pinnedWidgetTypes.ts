import type { AppTranslationKey } from "@mms/shared";
import type React from "react";
import {
  GraduationCap,
  CalendarCheck,
  BookOpen,
  UserCheck,
  DollarSign,
  AlertCircle,
  Star,
  TrendingUp,
  Receipt,
  Users,
  Target,
  ShieldCheck,
  Award,
  Clock,
  Heart,
  Briefcase,
  Activity,
  CheckCircle2,
  PieChart,
  Zap,
  BarChart2,
} from "lucide-react";
import { WIDGET_CHART_PALETTES } from "@mms/shared";
import type { CustomCard } from "./reportMetadata";

export interface CustomWidget {
  id: string;
  title: string;
  /** When set, dashboard/report UI uses `t(titleKey)` instead of `title`. */
  titleKey?: AppTranslationKey;
  category: string;
  collection: CustomCard["collection"];

  widgetType?:
    | "kpi"
    | "progress"
    | "switch"
    | "chart"
    | "sessions-list"
    | "attendance-summary"
    | "fee-summary"
    | "outstanding-list"
    | "overdue-obligations"
    | "enrollment-trends"
    | "revenue-expenses"
    | "attendance-rate"
    | "hasanat-distribution"
    | "card";

  // Card fields merged
  icon?: string;
  subTextType?: "fixed" | "dynamic";
  fixedSubText?: string;
  /** When set (or mapped via DEFAULT_WIDGET_SUBTEXT_KEYS), UI uses `t(fixedSubTextKey)` instead of English `fixedSubText`. */
  fixedSubTextKey?: AppTranslationKey;
  trend?: number;
  trendType?: "manual" | "database";
  role?: string;

  // Switch utility settings
  switchActionType?: "app_setting" | "db_record";
  switchStateKey?: string;
  switchLabelOn?: string;
  switchLabelOff?: string;
  /** When set, UI uses `t(switchLabelOnKey)` instead of English `switchLabelOn`. */
  switchLabelOnKey?: AppTranslationKey;
  switchLabelOffKey?: AppTranslationKey;
  switchCollection?: CustomCard["collection"];
  switchRecordId?: string;
  switchField?: string;

  // Threshold alert settings
  thresholdEnabled?: boolean;
  thresholdCondition?: "lt" | "gt" | "equals";
  thresholdValue?: number;
  thresholdColor?: "red" | "amber" | "yellow";

  // Existing properties for Recharts chart rendering (fallback/compatibility)
  chartType?: "bar" | "line" | "area" | "pie" | "radar" | "kpi" | "progress" | "switch";
  xAxisField?: string;
  operation: "count" | "sum" | "avg" | "percentage";
  targetField?: string;
  filterField?: string;
  filterOperator?: "equals" | "contains" | "gt" | "lt";
  filterValue?: string;
  color: string;
  isPinnedToDashboard: boolean;
  sortOrder?: number;
}

const ALERT_COLOR_MAP: Record<string, { bg: string; text: string; border: string; glow: string }> =
  {
    red: {
      bg: "bg-destructive/10 dark:bg-destructive/15",
      text: "text-destructive dark:text-destructive",
      border: "border-destructive/30 dark:border-destructive/20",
      glow: "shadow-glow-destructive",
    },
    amber: {
      bg: "bg-warning/10 dark:bg-warning/15",
      text: "text-warning dark:text-warning",
      border: "border-warning/30 dark:border-warning/20",
      glow: "shadow-glow-warning",
    },
    yellow: {
      bg: "bg-warning/10 dark:bg-warning/15",
      text: "text-warning",
      border: "border-warning/30 dark:border-warning/20",
      glow: "shadow-glow-warning",
    },
  };

const COLOR_MAP: Record<
  string,
  { bg: string; text: string; ring: string; glow: string; bar: string }
> = {
  emerald: {
    bg: "bg-success/10",
    text: "text-success",
    ring: "ring-success/20",
    glow: "bg-success/5 blur-xl group-hover:bg-success/10",
    bar: "bg-success",
  },
  blue: {
    bg: "bg-info/10",
    text: "text-info",
    ring: "ring-info/20",
    glow: "bg-info/5 blur-xl group-hover:bg-info/10",
    bar: "bg-info",
  },
  violet: {
    bg: "bg-primary/10",
    text: "text-primary",
    ring: "ring-primary/20",
    glow: "bg-primary/5 blur-xl group-hover:bg-primary/10",
    bar: "bg-primary",
  },
  amber: {
    bg: "bg-warning/10",
    text: "text-warning",
    ring: "ring-warning/20",
    glow: "bg-warning/5 blur-xl group-hover:bg-warning/10",
    bar: "bg-warning",
  },
  red: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    ring: "ring-destructive/20",
    glow: "bg-destructive/5 blur-xl group-hover:bg-destructive/10",
    bar: "bg-destructive",
  },
};

const ICONS_LIST: Record<string, React.ElementType> = {
  GraduationCap,
  CalendarCheck,
  BookOpen,
  UserCheck,
  DollarSign,
  AlertCircle,
  Star,
  TrendingUp,
  Receipt,
  Users,
  Target,
  ShieldCheck,
  Award,
  Clock,
  Heart,
  Briefcase,
  Activity,
  CheckCircle2,
  PieChart,
  Zap,
  BarChart2,
};

export { ALERT_COLOR_MAP, WIDGET_CHART_PALETTES as THEME_PALETTES, COLOR_MAP, ICONS_LIST };
