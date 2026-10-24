import { useState, useRef } from "react";
import { DEFAULT_CHART_PALETTE_ID, getChartPaletteColors } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { METADATA_FIELDS, type VisualizerConfig } from "@/lib/reports/reportMetadata";
import type {
  ChartOperation,
  ChartType,
  CollectionMeta,
  CustomWidget,
  FilterRule,
} from "@/components/reports/dynamicChartVisualizerTypes";
import { useDynamicChartVisualizerMetaEffects } from "@/components/reports/useDynamicChartVisualizerEffects";
import { useDynamicChartVisualizerContainer } from "@/components/reports/useDynamicChartVisualizerContainer";
import { isVisualizerWidgetPinned } from "@/components/reports/dynamicChartVisualizerPin";
import { buildDynamicChartVisualizerHandlers } from "@/components/reports/useDynamicChartVisualizerHandlers";
import { useDynamicChartVisualizerData } from "@/tenant/features/reports/hooks/useDynamicChartVisualizerData";

const METADATA_CONFIGS: Record<string, CollectionMeta> = METADATA_FIELDS;

interface UseDynamicChartVisualizerOptions {
  initialConfig?: VisualizerConfig;
  onSave?: (config: VisualizerConfig) => void;
}

export function useDynamicChartVisualizer({
  initialConfig,
  onSave,
}: UseDynamicChartVisualizerOptions = {}) {
  const { t } = useTranslation();
  const chartRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  const [title, setTitle] = useState(
    () => initialConfig?.title || t("reports.visualizer.defaultTitle"),
  );
  const [collectionKey, setCollectionKey] = useState<keyof typeof METADATA_CONFIGS>(
    initialConfig?.collection || "students",
  );
  const [chartType, setChartType] = useState<ChartType>(initialConfig?.chartType || "bar");
  const [xAxisField, setXAxisField] = useState(initialConfig?.xAxisField || "status");
  const [operation, setOperation] = useState<ChartOperation>(initialConfig?.operation || "count");
  const [targetField, setTargetField] = useState(initialConfig?.targetField || "");
  const [activePalette, setActivePalette] = useState(
    initialConfig?.activePalette || DEFAULT_CHART_PALETTE_ID,
  );

  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showTooltip, setShowTooltip] = useState(true);
  const [showDataTable, setShowDataTable] = useState(false);
  const [pdfOrientation, setPdfOrientation] = useState<"p" | "l">("p");
  const [pdfFormat, setPdfFormat] = useState<string>("a4");
  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const { customWidgets: dashboardWidgets, updateCustomWidgets, canPin } = useDashboardConfig();
  // The visualizer narrows to chart-type widgets; the dashboard store holds the canonical set.
  const visualizerWidgets = dashboardWidgets as CustomWidget[];

  const { containerWidth, axisFontSize, legendFontSize, tickGap } =
    useDynamicChartVisualizerContainer(chartRef);
  const activeMeta = METADATA_CONFIGS[collectionKey];

  useDynamicChartVisualizerMetaEffects({
    collectionKey,
    xAxisField,
    operation,
    activeMeta,
    metadataConfigs: METADATA_CONFIGS,
    isInitialMount,
    setXAxisField,
    setChartType,
    setTargetField,
    setOperation,
    setFilters,
  });

  const processedData = useDynamicChartVisualizerData({
    collectionKey,
    operation,
    targetField,
    xAxisField,
    filters,
  });

  const isPinned = isVisualizerWidgetPinned(
    visualizerWidgets,
    collectionKey,
    xAxisField,
    operation,
    chartType,
  );

  const {
    handleTogglePin,
    handleAddFilter,
    handleUpdateFilter,
    handleDeleteFilter,
    handleExportPNG,
    handleExportExcel,
    handleExportPDF,
    handleSaveVisual,
  } = buildDynamicChartVisualizerHandlers({
    chartRef,
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
    dashboardWidgets: visualizerWidgets,
    persistWidgets: updateCustomWidgets,
    processedData,
    pdfFormat,
    pdfOrientation,
    initialConfig,
    onSave,
    onExportFailed: () => {
      notify.error(t("reports.visualizer.exportFailed"));
    },
  });

  const currentColors = [...getChartPaletteColors(activePalette)];

  return {
    t,
    chartRef,
    title,
    setTitle,
    collectionKey,
    setCollectionKey,
    chartType,
    setChartType,
    xAxisField,
    setXAxisField,
    operation,
    setOperation,
    targetField,
    setTargetField,
    activePalette,
    setActivePalette,
    showGrid,
    setShowGrid,
    showLegend,
    setShowLegend,
    showTooltip,
    setShowTooltip,
    showDataTable,
    showPdfSettings,
    pdfOrientation,
    pdfFormat,
    containerWidth,
    axisFontSize,
    legendFontSize,
    tickGap,
    activeMeta,
    metadataConfigs: METADATA_CONFIGS,
    filters,
    processedData,
    currentColors,
    isPinned,
    canPin,
    handleTogglePin,
    handleAddFilter,
    handleUpdateFilter,
    handleDeleteFilter,
    handleExportPNG,
    handleExportExcel,
    handleExportPDF,
    handleSaveVisual,
    setShowDataTable,
    setShowPdfSettings,
    setPdfOrientation,
    setPdfFormat,
  };
}

export { METADATA_CONFIGS };
