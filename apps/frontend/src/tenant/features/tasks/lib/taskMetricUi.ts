import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Ban, CheckCircle2, Clock, ListTodo, TrendingUp } from "lucide-react";
import type { AccentColor } from "@/components/app/statCardAccent";

export interface TaskMetricUi {
  icon: LucideIcon;
  accent: AccentColor;
}

/**
 * SSOT for task KPI card icon + accent, shared by the Work-tier command strip
 * (`TasksCommandMetrics`) and the Reports tier (`TasksReportsTab`) so the two
 * surfaces cannot drift (2026-11-19 enhancement).
 */
export const TASK_METRIC_UI = {
  total: { icon: ListTodo, accent: "primary" },
  inProgress: { icon: Clock, accent: "info" },
  completed: { icon: CheckCircle2, accent: "success" },
  blocked: { icon: Ban, accent: "destructive" },
  overdue: { icon: AlertTriangle, accent: "warning" },
  completionRate: { icon: TrendingUp, accent: "primary" },
} satisfies Record<string, TaskMetricUi>;
