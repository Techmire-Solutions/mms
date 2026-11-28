/**
 * Minimal widget shape accepted for duplicate detection.
 * Compatible with both `DashboardWidgetDto` and frontend `CustomWidget`.
 */
export interface DashboardWidgetComparisonTarget {
  id?: string;
  category?: string;
  collection: string;
  widgetType?: string;
  operation: string;
  targetField?: string;
  filterField?: string;
  filterOperator?: string;
  filterValue?: string;
  role?: string;
  switchActionType?: string;
  switchStateKey?: string;
  switchCollection?: string;
  switchRecordId?: string;
  switchField?: string;
  chartType?: string;
  xAxisField?: string;
}

function normalizeCategory(category?: string | null): string {
  if (!category) return "";
  const cat = category.trim().toLowerCase();
  if (cat === "finance" || cat === "financial") return "financial";
  if (cat === "academic" || cat === "examinations") return "examinations";
  if (cat === "question-bank" || cat === "questionbank") return "questionbank";
  return cat;
}

function normalizeString(val?: string | null): string {
  return (val ?? "").trim();
}

/**
 * Checks whether two widgets share the exact same functional configuration,
 * ignoring title, visual styling (color, icon), id, and sort order.
 */
export function areDashboardWidgetsDuplicate(
  a: DashboardWidgetComparisonTarget,
  b: DashboardWidgetComparisonTarget,
): boolean {
  // If both have the same non-empty ID, they are the same widget being updated
  if (a.id && b.id && a.id === b.id) {
    return false;
  }

  // Must belong to the same module/category
  if (normalizeCategory(a.category) !== normalizeCategory(b.category)) {
    return false;
  }

  const typeA = (a.widgetType || "kpi").toLowerCase();
  const typeB = (b.widgetType || "kpi").toLowerCase();
  if (typeA !== typeB) {
    return false;
  }

  // Same collection
  if (normalizeString(a.collection) !== normalizeString(b.collection)) {
    return false;
  }

  if (typeA === "switch") {
    const actionA = a.switchActionType || "app_setting";
    const actionB = b.switchActionType || "app_setting";
    if (actionA !== actionB) return false;
    if (actionA === "app_setting") {
      return normalizeString(a.switchStateKey) === normalizeString(b.switchStateKey);
    }
    return (
      normalizeString(a.switchCollection) === normalizeString(b.switchCollection) &&
      normalizeString(a.switchRecordId) === normalizeString(b.switchRecordId) &&
      normalizeString(a.switchField || "status") === normalizeString(b.switchField || "status")
    );
  }

  // Metric widgets: kpi, card, progress, chart
  if (normalizeString(a.operation) !== normalizeString(b.operation)) {
    return false;
  }

  if (normalizeString(a.targetField) !== normalizeString(b.targetField)) {
    return false;
  }

  const filterFieldA = normalizeString(a.filterField);
  const filterFieldB = normalizeString(b.filterField);
  if (filterFieldA !== filterFieldB) {
    return false;
  }

  if (filterFieldA) {
    const opA = a.filterOperator || "equals";
    const opB = b.filterOperator || "equals";
    if (opA !== opB) return false;
    if (
      normalizeString(a.filterValue).toLowerCase() !== normalizeString(b.filterValue).toLowerCase()
    ) {
      return false;
    }
  }

  if (normalizeString(a.role) !== normalizeString(b.role)) {
    return false;
  }

  if (typeA === "chart") {
    if (normalizeString(a.chartType) !== normalizeString(b.chartType)) return false;
    if (normalizeString(a.xAxisField) !== normalizeString(b.xAxisField)) return false;
  }

  return true;
}

/**
 * Finds an existing widget on the dashboard that has an identical functional
 * configuration to the candidate widget. Returns the matching widget, or null.
 */
export function findDuplicateDashboardWidget<T extends DashboardWidgetComparisonTarget>(
  candidate: T,
  existingWidgets: T[],
): T | null {
  return (
    existingWidgets.find((existing) => areDashboardWidgetsDuplicate(candidate, existing)) ?? null
  );
}
