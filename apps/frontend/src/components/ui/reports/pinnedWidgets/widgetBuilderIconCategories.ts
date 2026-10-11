export type WidgetBuilderIconTab = "all" | "academic" | "finance" | "status" | "general";

export const WIDGET_BUILDER_ICON_CATEGORIES: Record<
  Exclude<WidgetBuilderIconTab, "all">,
  string[]
> = {
  academic: ["GraduationCap", "Users", "UserCheck", "Award", "ShieldCheck", "BookOpen"],
  finance: [
    "DollarSign",
    "TrendingUp",
    "Receipt",
    "Target",
    "PieChart",
    "Activity",
    "Briefcase",
    "BarChart2",
  ],
  status: ["CalendarCheck", "AlertCircle", "Clock", "CheckCircle2", "Zap"],
  general: ["Star", "Heart"],
};
