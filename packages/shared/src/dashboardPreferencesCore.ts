/**
 * Dashboard preference keys, defaults, and server write/normalize contracts.
 */
import { z } from "zod";

/** Alert when attendance rate drops below this percent. */
export const DASHBOARD_LOW_ATTENDANCE_THRESHOLD = 75;
/** Mark low-attendance notification urgent below this percent. */
export const DASHBOARD_URGENT_ATTENDANCE_THRESHOLD = 60;

export interface DashboardPreferences {
  disabledCardIds: string[];
  gridMode: "comfortable" | "compact";
  lowAttendanceThreshold: number;
  urgentAttendanceThreshold: number;
  enrollmentChartType: "area" | "bar" | "line";
  enrollmentChartColor: "emerald" | "blue" | "violet" | "amber" | "red";
  enrollmentChartPeriod: number;
  revenueChartType: "bar" | "line" | "area";
  revenueChartColor: string;
  attendanceChartType: "bar" | "line" | "area";
  attendanceChartColor: string;
  hasanatChartType: "pie" | "bar" | "radar";
  hasanatChartColor: string;
}

export const DASHBOARD_DISABLED_CARDS_KEY = "mms_dashboard_disabled_cards";
export const DASHBOARD_WIDGETS_KEY = "kpi_custom_widgets";
export const DASHBOARD_PREFERENCES_KEY = "mms_dashboard_preferences";

export const PINNED_WIDGETS_GRID_MODE_KEY = "pinned_widgets_grid_mode";

export const ENROLLMENT_CHART_TYPE_KEY = "db_chart_type_enrollment";
export const ENROLLMENT_CHART_COLOR_KEY = "db_chart_color_enrollment";
export const ENROLLMENT_CHART_PERIOD_KEY = "db_chart_period_enrollment";

export const REVENUE_CHART_TYPE_KEY = "db_chart_type_revenue";
export const REVENUE_CHART_COLOR_KEY = "db_chart_color_revenue";

export const ATTENDANCE_CHART_TYPE_KEY = "db_chart_type_attendance";
export const ATTENDANCE_CHART_COLOR_KEY = "db_chart_color_attendance";

export const HASANAT_CHART_TYPE_KEY = "db_chart_type_hasanat";
export const HASANAT_CHART_COLOR_KEY = "db_chart_color_hasanat";

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  disabledCardIds: [],
  gridMode: "comfortable",
  lowAttendanceThreshold: DASHBOARD_LOW_ATTENDANCE_THRESHOLD,
  urgentAttendanceThreshold: DASHBOARD_URGENT_ATTENDANCE_THRESHOLD,
  enrollmentChartType: "area",
  enrollmentChartColor: "emerald",
  enrollmentChartPeriod: 10,
  revenueChartType: "bar",
  revenueChartColor: "mixed",
  attendanceChartType: "bar",
  attendanceChartColor: "semantic",
  hasanatChartType: "pie",
  hasanatChartColor: "mixed",
};

const GRID_MODES = ["comfortable", "compact"] as const;
const ENROLLMENT_CHART_TYPES = ["area", "bar", "line"] as const;
const TREND_CHART_TYPES = ["bar", "line", "area"] as const;
const HASANAT_CHART_TYPES = ["pie", "bar", "radar"] as const;
const ENROLLMENT_COLORS = ["emerald", "blue", "violet", "amber", "red"] as const;

/** PUT /api/dashboard/preferences — layout / chart prefs (passthrough like siblings). */
export const dashboardPreferencesPutBodySchema = z
  .object({
    disabledCardIds: z.array(z.string()).optional(),
    gridMode: z.enum(GRID_MODES).optional(),
    lowAttendanceThreshold: z.number().min(1).max(100).optional(),
    urgentAttendanceThreshold: z.number().min(1).max(100).optional(),
    enrollmentChartType: z.enum(ENROLLMENT_CHART_TYPES).optional(),
    enrollmentChartColor: z.enum(ENROLLMENT_COLORS).optional(),
    enrollmentChartPeriod: z.number().optional(),
    revenueChartType: z.enum(TREND_CHART_TYPES).optional(),
    revenueChartColor: z.string().optional(),
    attendanceChartType: z.enum(TREND_CHART_TYPES).optional(),
    attendanceChartColor: z.string().optional(),
    hasanatChartType: z.enum(HASANAT_CHART_TYPES).optional(),
    hasanatChartColor: z.string().optional(),
  })
  .passthrough();

export type DashboardPreferencesPutBody = z.infer<typeof dashboardPreferencesPutBodySchema>;

const DASHBOARD_PREFERENCE_KEYS = [
  "disabledCardIds",
  "gridMode",
  "lowAttendanceThreshold",
  "urgentAttendanceThreshold",
  "enrollmentChartType",
  "enrollmentChartColor",
  "enrollmentChartPeriod",
  "revenueChartType",
  "revenueChartColor",
  "attendanceChartType",
  "attendanceChartColor",
  "hasanatChartType",
  "hasanatChartColor",
] as const;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

/** Normalize dashboard layout/chart preferences against typed defaults. */
export function normalizeDashboardPreferences(
  partial?: Partial<DashboardPreferences> | Record<string, unknown> | null,
): DashboardPreferences {
  const defaults = DEFAULT_DASHBOARD_PREFERENCES;
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) {
    return { ...defaults };
  }
  const src = partial as Record<string, unknown>;

  const lowAttendanceThreshold =
    typeof src.lowAttendanceThreshold === "number" &&
    Number.isFinite(src.lowAttendanceThreshold) &&
    src.lowAttendanceThreshold >= 1 &&
    src.lowAttendanceThreshold <= 100
      ? Math.round(src.lowAttendanceThreshold)
      : defaults.lowAttendanceThreshold;

  const urgentAttendanceThreshold =
    typeof src.urgentAttendanceThreshold === "number" &&
    Number.isFinite(src.urgentAttendanceThreshold) &&
    src.urgentAttendanceThreshold >= 1 &&
    src.urgentAttendanceThreshold <= 100
      ? Math.round(src.urgentAttendanceThreshold)
      : defaults.urgentAttendanceThreshold;

  return {
    disabledCardIds: isStringArray(src.disabledCardIds)
      ? src.disabledCardIds
      : defaults.disabledCardIds,
    gridMode: isOneOf(src.gridMode, GRID_MODES) ? src.gridMode : defaults.gridMode,
    lowAttendanceThreshold,
    urgentAttendanceThreshold,
    enrollmentChartType: isOneOf(src.enrollmentChartType, ENROLLMENT_CHART_TYPES)
      ? src.enrollmentChartType
      : defaults.enrollmentChartType,
    enrollmentChartColor: isOneOf(src.enrollmentChartColor, ENROLLMENT_COLORS)
      ? src.enrollmentChartColor
      : defaults.enrollmentChartColor,
    enrollmentChartPeriod:
      typeof src.enrollmentChartPeriod === "number" &&
      Number.isFinite(src.enrollmentChartPeriod) &&
      src.enrollmentChartPeriod > 0
        ? Math.floor(src.enrollmentChartPeriod)
        : defaults.enrollmentChartPeriod,
    revenueChartType: isOneOf(src.revenueChartType, TREND_CHART_TYPES)
      ? src.revenueChartType
      : defaults.revenueChartType,
    revenueChartColor:
      typeof src.revenueChartColor === "string" && src.revenueChartColor
        ? src.revenueChartColor
        : defaults.revenueChartColor,
    attendanceChartType: isOneOf(src.attendanceChartType, TREND_CHART_TYPES)
      ? src.attendanceChartType
      : defaults.attendanceChartType,
    attendanceChartColor:
      typeof src.attendanceChartColor === "string" && src.attendanceChartColor
        ? src.attendanceChartColor
        : defaults.attendanceChartColor,
    hasanatChartType: isOneOf(src.hasanatChartType, HASANAT_CHART_TYPES)
      ? src.hasanatChartType
      : defaults.hasanatChartType,
    hasanatChartColor:
      typeof src.hasanatChartColor === "string" && src.hasanatChartColor
        ? src.hasanatChartColor
        : defaults.hasanatChartColor,
  };
}

export { DASHBOARD_PREFERENCE_KEYS as DASHBOARD_MODULE_PREFERENCE_KEYS };
