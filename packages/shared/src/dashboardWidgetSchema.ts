/**
 * Server-authoritative dashboard widget write contract.
 * The FE `CustomWidget` interface (`apps/frontend/src/lib/reports/pinnedWidgetTypes.ts`)
 * remains the app-side canonical type; this Zod schema is the FE↔BE wire DTO persisted on
 * the typed `dashboard_widgets` table (indexed columns + jsonb `config` for the remainder).
 */
import { z } from "zod";

const WIDGET_TYPES = [
  "kpi",
  "progress",
  "switch",
  "chart",
  "sessions-list",
  "attendance-summary",
  "fee-summary",
  "outstanding-list",
  "overdue-obligations",
  "enrollment-trends",
  "revenue-expenses",
  "attendance-rate",
  "hasanat-distribution",
  "card",
] as const;

const OPERATIONS = ["count", "sum", "avg", "percentage"] as const;
const SUB_TEXT_TYPES = ["fixed", "dynamic"] as const;
const TREND_TYPES = ["manual", "database"] as const;
const SWITCH_ACTION_TYPES = ["app_setting", "db_record"] as const;
const THRESHOLD_CONDITIONS = ["lt", "gt", "equals"] as const;
const THRESHOLD_COLORS = ["red", "amber", "yellow"] as const;
const FILTER_OPERATORS = ["equals", "contains", "gt", "lt"] as const;
const CHART_TYPES = ["bar", "line", "area", "pie", "radar", "kpi", "progress", "switch"] as const;

/** Single dashboard widget — resilient write DTO (accepts clean shapes, strips anomalies during normalization). */
export const customWidgetSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    titleKey: z.string().optional(),
    category: z.string(),
    collection: z.string(),
    widgetType: z.enum(WIDGET_TYPES).optional(),
    icon: z.string().optional(),
    subTextType: z.enum(SUB_TEXT_TYPES).optional(),
    fixedSubText: z.string().optional(),
    fixedSubTextKey: z.string().optional(),
    trend: z.number().optional(),
    trendType: z.enum(TREND_TYPES).optional(),
    role: z.string().optional(),
    switchActionType: z.enum(SWITCH_ACTION_TYPES).optional(),
    switchStateKey: z.string().optional(),
    switchLabelOn: z.string().optional(),
    switchLabelOff: z.string().optional(),
    switchLabelOnKey: z.string().optional(),
    switchLabelOffKey: z.string().optional(),
    switchCollection: z.string().optional(),
    switchRecordId: z.string().optional(),
    switchField: z.string().optional(),
    thresholdEnabled: z.boolean().optional(),
    thresholdCondition: z.enum(THRESHOLD_CONDITIONS).optional(),
    thresholdValue: z.number().optional(),
    thresholdColor: z.enum(THRESHOLD_COLORS).optional(),
    chartType: z.enum(CHART_TYPES).optional(),
    xAxisField: z.string().optional(),
    operation: z.enum(OPERATIONS),
    targetField: z.string().optional(),
    filterField: z.string().optional(),
    filterOperator: z.enum(FILTER_OPERATORS).optional(),
    filterValue: z.string().optional(),
    color: z.string(),
    isPinnedToDashboard: z.boolean(),
    /** Stable pin order within the dashboard layout (BE defaults to array index). */
    sortOrder: z.number().optional(),
  })
  .passthrough();

export type DashboardWidgetDto = z.infer<typeof customWidgetSchema>;

/**
 * Pure helper for normalizing arbitrary raw widget records (e.g. from local storage,
 * legacy snapshots, or forms) into strictly valid `DashboardWidgetDto`s.
 */
export function normalizeDashboardWidget(raw: unknown): DashboardWidgetDto | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : null;
  if (!id) return null;

  const rawWidgetType = (r.widgetType ?? r.type) as string | undefined;
  const widgetType =
    typeof rawWidgetType === "string" && rawWidgetType.trim().length > 0
      ? (rawWidgetType.trim().toLowerCase() as DashboardWidgetDto["widgetType"])
      : undefined;

  const rawOp = typeof r.operation === "string" ? r.operation.trim().toLowerCase() : "";
  const operation = (OPERATIONS as readonly string[]).includes(rawOp)
    ? (rawOp as DashboardWidgetDto["operation"])
    : typeof r.operation === "string"
      ? (r.operation.trim() as DashboardWidgetDto["operation"])
      : "count";

  const sanitizeOptionalEnum = <T extends string>(
    val: unknown,
    allowedValues: readonly T[],
  ): T | undefined => {
    if (typeof val === "string") {
      const lower = val.trim().toLowerCase();
      if ((allowedValues as readonly string[]).includes(lower)) {
        return lower as T;
      }
    }
    return undefined;
  };

  const subTextType = sanitizeOptionalEnum(r.subTextType, SUB_TEXT_TYPES);
  const trendType = sanitizeOptionalEnum(r.trendType, TREND_TYPES);
  const switchActionType = sanitizeOptionalEnum(r.switchActionType, SWITCH_ACTION_TYPES);
  const thresholdCondition = sanitizeOptionalEnum(r.thresholdCondition, THRESHOLD_CONDITIONS);
  const thresholdColor = sanitizeOptionalEnum(r.thresholdColor, THRESHOLD_COLORS);
  const filterOperator = sanitizeOptionalEnum(r.filterOperator, FILTER_OPERATORS);
  const chartType = sanitizeOptionalEnum(r.chartType, CHART_TYPES);

  const sanitizeString = (val: unknown): string | undefined => {
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
    return undefined;
  };

  const sanitizeNumber = (val: unknown): number | undefined => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string" && val.trim() !== "") {
      const num = Number(val);
      if (Number.isFinite(num)) return num;
    }
    return undefined;
  };

  const rawThreshold = r.thresholdValue ?? r.threshold;
  const thresholdValue = sanitizeNumber(rawThreshold);
  const trend = sanitizeNumber(r.trend);
  const sortOrder = sanitizeNumber(r.sortOrder);

  const title = typeof r.title === "string" ? r.title : "";
  const titleKey = sanitizeString(r.titleKey);
  const category = (sanitizeString(r.category) ?? "custom").toLowerCase();
  const collection = (sanitizeString(r.collection) ?? "students").toLowerCase();
  const color = (sanitizeString(r.color) ?? "blue").toLowerCase();
  const icon = sanitizeString(r.icon);
  const role = sanitizeString(r.role)?.toLowerCase();

  const fixedSubText = sanitizeString(r.fixedSubText);
  const fixedSubTextKey = sanitizeString(r.fixedSubTextKey);

  const switchStateKey = sanitizeString(r.switchStateKey);
  const switchLabelOn = sanitizeString(r.switchLabelOn);
  const switchLabelOff = sanitizeString(r.switchLabelOff);
  const switchLabelOnKey = sanitizeString(r.switchLabelOnKey);
  const switchLabelOffKey = sanitizeString(r.switchLabelOffKey);
  const switchCollection = sanitizeString(r.switchCollection);
  const switchRecordId = sanitizeString(r.switchRecordId);
  const switchField = sanitizeString(r.switchField);

  const targetField = sanitizeString(r.targetField);
  const filterField = sanitizeString(r.filterField);
  const filterValue = sanitizeString(r.filterValue);
  const xAxisField = sanitizeString(r.xAxisField);

  const isPinnedToDashboard = Boolean(r.isPinnedToDashboard);
  const thresholdEnabled = Boolean(r.thresholdEnabled);

  const dto: DashboardWidgetDto = {
    id,
    title,
    category,
    collection,
    operation,
    color,
    isPinnedToDashboard,
  };

  if (titleKey) dto.titleKey = titleKey;
  if (widgetType) dto.widgetType = widgetType;
  if (icon) dto.icon = icon;
  if (subTextType) dto.subTextType = subTextType;
  if (fixedSubText) dto.fixedSubText = fixedSubText;
  if (fixedSubTextKey) dto.fixedSubTextKey = fixedSubTextKey;
  if (trend !== undefined) dto.trend = trend;
  if (trendType) dto.trendType = trendType;
  if (role) dto.role = role;
  if (switchActionType) dto.switchActionType = switchActionType;
  if (switchStateKey) dto.switchStateKey = switchStateKey;
  if (switchLabelOn) dto.switchLabelOn = switchLabelOn;
  if (switchLabelOff) dto.switchLabelOff = switchLabelOff;
  if (switchLabelOnKey) dto.switchLabelOnKey = switchLabelOnKey;
  if (switchLabelOffKey) dto.switchLabelOffKey = switchLabelOffKey;
  if (switchCollection) dto.switchCollection = switchCollection;
  if (switchRecordId) dto.switchRecordId = switchRecordId;
  if (switchField) dto.switchField = switchField;
  if (thresholdEnabled) dto.thresholdEnabled = true;
  if (thresholdCondition) dto.thresholdCondition = thresholdCondition;
  if (thresholdValue !== undefined) dto.thresholdValue = thresholdValue;
  if (thresholdColor) dto.thresholdColor = thresholdColor;
  if (chartType) dto.chartType = chartType;
  if (xAxisField) dto.xAxisField = xAxisField;
  if (targetField) dto.targetField = targetField;
  if (filterField) dto.filterField = filterField;
  if (filterOperator) dto.filterOperator = filterOperator;
  if (filterValue) dto.filterValue = filterValue;
  if (sortOrder !== undefined) dto.sortOrder = sortOrder;

  return dto;
}

/**
 * Normalizes an array of raw widgets, filtering out invalid items and coercing types.
 */
export function normalizeDashboardWidgets(raw: unknown): DashboardWidgetDto[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const widgets: DashboardWidgetDto[] = [];
    for (const item of raw) {
      const normalized = normalizeDashboardWidget(item);
      if (normalized) widgets.push(normalized);
    }
    return widgets;
  }
  if (typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.widgets)) {
      return normalizeDashboardWidgets(r.widgets);
    }
    const single = normalizeDashboardWidget(raw);
    return single ? [single] : [];
  }
  return [];
}

/** PUT /api/dashboard/widgets — bulk upsert (insert + update; no wipe). */
export const dashboardWidgetsPutBodySchema = z.preprocess(
  (val) => normalizeDashboardWidgets(val),
  z.array(customWidgetSchema).max(500, "Too many widgets in one request"),
);

export type DashboardWidgetsPutBody = z.infer<typeof dashboardWidgetsPutBodySchema>;

/** Indexed columns projected onto `dashboard_widgets` typed fields. */
export const DASHBOARD_WIDGET_INDEXED_KEYS = [
  "id",
  "widgetType",
  "category",
  "collection",
  "role",
  "isPinnedToDashboard",
  "title",
  "icon",
  "color",
  "operation",
  "sortOrder",
] as const;
