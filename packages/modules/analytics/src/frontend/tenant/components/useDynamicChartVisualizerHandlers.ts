import type { FilterRule, CustomWidget } from "./dynamicChartVisualizerTypes";
import type { VisualizerConfig } from "../lib/reportMetadata";
import {
  createFilterRule,
  deleteFilterRule,
  getDefaultCollectionField,
  toggleVisualizerWidgetPin,
  updateFilterRules,
} from "./dynamicChartVisualizerPin";
import {
  exportVisualizerExcel,
  exportVisualizerPdf,
  exportVisualizerPng,
} from "./dynamicChartVisualizerExports";
import type { AggregatedItem, ChartOperation, ChartType } from "./dynamicChartVisualizerTypes";
import type { CollectionMeta } from "./dynamicChartVisualizerTypes";

interface BuildVisualizerHandlersOptions {
  /** Event-time accessor for the chart DOM node — the handlers never touch a ref during render. */
  getChartElement: () => HTMLDivElement | null;
  title: string;
  collectionKey: string;
  xAxisField: string;
  operation: ChartOperation;
  chartType: ChartType;
  targetField: string;
  activePalette: string;
  activeMeta: CollectionMeta;
  filters: FilterRule[];
  setFilters: (filters: FilterRule[]) => void;
  dashboardWidgets: CustomWidget[];
  persistWidgets: (widgets: CustomWidget[]) => void;
  processedData: AggregatedItem[];
  pdfFormat: string;
  pdfOrientation: "p" | "l";
  initialConfig?: VisualizerConfig;
  onSave?: (config: VisualizerConfig) => void;
  onExportFailed: () => void;
}

export function buildDynamicChartVisualizerHandlers({
  getChartElement,
  title,
  collectionKey,
  xAxisField,
  operation,
  chartType,
  targetField,
  activePalette,
  activeMeta,
  filters,
  setFilters,
  dashboardWidgets,
  persistWidgets,
  processedData,
  pdfFormat,
  pdfOrientation,
  initialConfig,
  onSave,
  onExportFailed,
}: BuildVisualizerHandlersOptions) {
  const handleTogglePin = () => {
    const nextWidgets = toggleVisualizerWidgetPin({
      widgets: dashboardWidgets,
      collectionKey,
      xAxisField,
      operation,
      chartType,
      title,
      targetField,
      activePalette,
    });
    persistWidgets(nextWidgets);
  };

  const handleAddFilter = () => {
    const defaultField = getDefaultCollectionField(activeMeta);
    setFilters([...filters, createFilterRule(defaultField)]);
  };

  const handleUpdateFilter = (id: string, updates: Partial<FilterRule>) => {
    setFilters(updateFilterRules(filters, id, updates));
  };

  const handleDeleteFilter = (id: string) => {
    setFilters(deleteFilterRule(filters, id));
  };

  const handleExportPNG = () => {
    const chartElement = getChartElement();
    if (!chartElement) return;
    void exportVisualizerPng({ chartElement, title }).catch(() => {
      onExportFailed();
    });
  };

  const handleExportExcel = () => {
    void exportVisualizerExcel({ title, processedData }).catch(() => {
      onExportFailed();
    });
  };

  const handleExportPDF = () => {
    const chartElement = getChartElement();
    if (!chartElement) return;
    void exportVisualizerPdf({
      chartElement,
      title,
      processedData,
      operation,
      xAxisField,
      collectionLabel: activeMeta.name,
      pdfFormat,
      pdfOrientation,
    }).catch(() => {
      onExportFailed();
    });
  };

  const handleSaveVisual = onSave
    ? () => {
        onSave({
          id: initialConfig?.id || "visual-" + Date.now(),
          title,
          collection: collectionKey as VisualizerConfig["collection"],
          chartType,
          xAxisField,
          operation,
          targetField,
          activePalette,
        });
      }
    : undefined;

  return {
    handleTogglePin,
    handleAddFilter,
    handleUpdateFilter,
    handleDeleteFilter,
    handleExportPNG,
    handleExportExcel,
    handleExportPDF,
    handleSaveVisual,
  };
}
