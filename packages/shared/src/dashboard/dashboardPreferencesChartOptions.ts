/**
 * Dashboard trend and module chart UI options and color catalogues.
 */
import type { AppTranslationKey } from "../i18n/appTranslations.js";
import type {
  ChartColorOption,
  DashboardChartType,
  HasanatChartType,
} from "./dashboardPreferencesTypes.js";

export interface ChartOption<V extends string> {
  value: V;
  labelKey: AppTranslationKey;
}

/** Trend-chart type options (bar/line/area) — shared label keys. */
export const DASHBOARD_CHART_TYPE_OPTIONS: readonly ChartOption<DashboardChartType>[] = [
  { value: "bar", labelKey: "dashboard.charts.types.bar" },
  { value: "line", labelKey: "dashboard.charts.types.line" },
  { value: "area", labelKey: "dashboard.charts.types.area" },
];

/** Hasanat chart type options (pie/bar/radar). */
export const DASHBOARD_HASANAT_CHART_TYPE_OPTIONS: readonly ChartOption<HasanatChartType>[] = [
  { value: "pie", labelKey: "dashboard.charts.types.pie" },
  { value: "bar", labelKey: "dashboard.charts.types.bar" },
  { value: "radar", labelKey: "dashboard.charts.types.radar" },
];

/** Full color-option catalogue; charts filter to their supported subset. */
export const DASHBOARD_CHART_COLOR_OPTIONS: readonly ChartOption<ChartColorOption>[] = [
  { value: "semantic", labelKey: "dashboard.charts.colors.semantic" },
  { value: "mixed", labelKey: "dashboard.charts.colors.mixed" },
  { value: "emerald", labelKey: "dashboard.charts.colors.emerald" },
  { value: "blue", labelKey: "dashboard.charts.colors.blue" },
  { value: "violet", labelKey: "dashboard.charts.colors.violet" },
  { value: "amber", labelKey: "dashboard.charts.colors.amber" },
  { value: "red", labelKey: "dashboard.charts.colors.red" },
];

/** Per-chart supported color subsets (preserves existing per-chart palettes). */
export const ATTENDANCE_CHART_COLOR_OPTIONS: readonly ChartColorOption[] = [
  "semantic",
  "emerald",
  "blue",
  "violet",
  "amber",
  "red",
];

export const ENROLLMENT_CHART_COLOR_OPTIONS: readonly ChartColorOption[] = [
  "emerald",
  "blue",
  "violet",
  "amber",
  "red",
];

export const REVENUE_CHART_COLOR_OPTIONS: readonly ChartColorOption[] = [
  "mixed",
  "emerald",
  "violet",
  "blue",
  "amber",
  "red",
];

export const HASANAT_CHART_COLOR_OPTIONS: readonly ChartColorOption[] = [
  "mixed",
  "emerald",
  "blue",
  "violet",
];
