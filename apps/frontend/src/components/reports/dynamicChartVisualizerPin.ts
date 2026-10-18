import { generateClientEntityId } from "@mms/shared";
import type {
  ChartOperation,
  ChartType,
  CustomWidget,
  FilterRule,
} from "./dynamicChartVisualizerTypes";
import { resolveWidgetPinColor } from "./dynamicChartVisualizerHelpers";
import type { CollectionMeta } from "./dynamicChartVisualizerTypes";

export function computeAxisFontSize(containerWidth: number): number {
  return Math.max(9, Math.min(13, Math.round(containerWidth / 60)));
}

export function computeLegendFontSize(containerWidth: number): number {
  return Math.max(10, Math.min(13, Math.round(containerWidth / 55)));
}

export function computeTickGap(containerWidth: number): number {
  return Math.max(10, Math.min(30, Math.round(containerWidth / 25)));
}

export function normalizePinOperation(operation: ChartOperation): "count" | "sum" | "avg" {
  return operation === "min" || operation === "max" ? "count" : operation;
}

export function isVisualizerWidgetPinned(
  widgets: CustomWidget[],
  collectionKey: string,
  xAxisField: string,
  operation: ChartOperation,
  chartType: ChartType,
): boolean {
  const normalizedOperation = normalizePinOperation(operation);
  return widgets.some(
    (widget) =>
      widget.collection === collectionKey &&
      widget.xAxisField === xAxisField &&
      widget.operation === normalizedOperation &&
      widget.chartType === chartType &&
      widget.isPinnedToDashboard,
  );
}

export function resolveWidgetCategory(collectionKey: string): string {
  if (collectionKey === "finance_invoices") return "financial";
  if (collectionKey === "attendance_records") return "attendance";
  return String(collectionKey);
}

export function toggleVisualizerWidgetPin(input: {
  widgets: CustomWidget[];
  collectionKey: string;
  xAxisField: string;
  operation: ChartOperation;
  chartType: ChartType;
  title: string;
  targetField: string;
  activePalette: string;
}): CustomWidget[] {
  const nextWidgets = [...input.widgets];
  const normalizedOperation = normalizePinOperation(input.operation);
  const matchingIndex = nextWidgets.findIndex(
    (widget) =>
      widget.collection === input.collectionKey &&
      widget.xAxisField === input.xAxisField &&
      widget.operation === normalizedOperation,
  );

  if (matchingIndex > -1) {
    // Immutable update — the input array is React Query cache data; never mutate in place.
    nextWidgets[matchingIndex] = {
      ...nextWidgets[matchingIndex],
      isPinnedToDashboard: !nextWidgets[matchingIndex].isPinnedToDashboard,
    };
  } else {
    const newWidget: CustomWidget = {
      id: generateClientEntityId("widget", "-"),
      title: input.title,
      category: resolveWidgetCategory(input.collectionKey),
      collection: input.collectionKey as CustomWidget["collection"],
      chartType: input.chartType,
      xAxisField: input.xAxisField,
      operation: normalizedOperation,
      targetField: input.targetField,
      color: resolveWidgetPinColor(input.activePalette),
      isPinnedToDashboard: true,
      filterOperator: "equals",
    };
    nextWidgets.push(newWidget);
  }

  return nextWidgets;
}

export function createFilterRule(defaultField: string): FilterRule {
  return {
    id: generateClientEntityId("filter", "-"),
    field: defaultField,
    operator: "equals",
    value: "",
  };
}

export function updateFilterRules(
  filters: FilterRule[],
  id: string,
  updates: Partial<FilterRule>,
): FilterRule[] {
  return filters.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule));
}

export function deleteFilterRule(filters: FilterRule[], id: string): FilterRule[] {
  return filters.filter((rule) => rule.id !== id);
}

export function getDefaultCollectionField(meta: CollectionMeta | undefined): string {
  return meta?.fields[0]?.value || "";
}
