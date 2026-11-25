import React from "react";
import { DynamicChartVisualizerConfigPanel } from "@/components/reports/DynamicChartVisualizerConfigPanel";
import { DynamicChartVisualizerPreview } from "@/components/reports/DynamicChartVisualizerPreview";
import { useDynamicChartVisualizer } from "@/tenant/features/reports/hooks/useDynamicChartVisualizer";
import type { VisualizerConfig } from "@/lib/reports/reportMetadata";

interface DynamicChartVisualizerProps {
  initialConfig?: VisualizerConfig;
  onSave?: (config: VisualizerConfig) => void;
  onClose?: () => void;
}

export default function DynamicChartVisualizer({
  initialConfig,
  onSave,
  onClose,
}: DynamicChartVisualizerProps = {}): React.JSX.Element {
  const visualizer = useDynamicChartVisualizer({ initialConfig, onSave });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-start font-sans">
      <DynamicChartVisualizerConfigPanel
        title={visualizer.title}
        setTitle={visualizer.setTitle}
        collectionKey={visualizer.collectionKey}
        setCollectionKey={(value) =>
          visualizer.setCollectionKey(value as typeof visualizer.collectionKey)
        }
        xAxisField={visualizer.xAxisField}
        setXAxisField={visualizer.setXAxisField}
        operation={visualizer.operation}
        setOperation={visualizer.setOperation}
        targetField={visualizer.targetField}
        setTargetField={visualizer.setTargetField}
        chartType={visualizer.chartType}
        setChartType={visualizer.setChartType}
        activePalette={visualizer.activePalette}
        setActivePalette={visualizer.setActivePalette}
        showGrid={visualizer.showGrid}
        setShowGrid={visualizer.setShowGrid}
        showLegend={visualizer.showLegend}
        setShowLegend={visualizer.setShowLegend}
        showTooltip={visualizer.showTooltip}
        setShowTooltip={visualizer.setShowTooltip}
        filters={visualizer.filters}
        activeMeta={visualizer.activeMeta}
        metadataConfigs={visualizer.metadataConfigs}
        onAddFilter={visualizer.handleAddFilter}
        onUpdateFilter={visualizer.handleUpdateFilter}
        onDeleteFilter={visualizer.handleDeleteFilter}
        t={visualizer.t}
      />

      <DynamicChartVisualizerPreview
        chartRef={visualizer.chartRef}
        title={visualizer.title}
        collectionKey={visualizer.collectionKey}
        chartType={visualizer.chartType}
        xAxisField={visualizer.xAxisField}
        operation={visualizer.operation}
        activeMeta={visualizer.activeMeta}
        processedData={visualizer.processedData}
        currentColors={visualizer.currentColors}
        showGrid={visualizer.showGrid}
        showLegend={visualizer.showLegend}
        showTooltip={visualizer.showTooltip}
        showDataTable={visualizer.showDataTable}
        showPdfSettings={visualizer.showPdfSettings}
        pdfOrientation={visualizer.pdfOrientation}
        pdfFormat={visualizer.pdfFormat}
        containerWidth={visualizer.containerWidth}
        axisFontSize={visualizer.axisFontSize}
        legendFontSize={visualizer.legendFontSize}
        tickGap={visualizer.tickGap}
        isPinned={visualizer.isPinned}
        canPin={visualizer.canPin}
        onSaveVisual={visualizer.handleSaveVisual}
        onClose={onClose}
        onTogglePin={visualizer.handleTogglePin}
        onExportPng={visualizer.handleExportPNG}
        onExportExcel={visualizer.handleExportExcel}
        onExportPdf={visualizer.handleExportPDF}
        onToggleDataTable={() => visualizer.setShowDataTable(!visualizer.showDataTable)}
        onTogglePdfSettings={() => visualizer.setShowPdfSettings(!visualizer.showPdfSettings)}
        onPdfOrientationChange={visualizer.setPdfOrientation}
        onPdfFormatChange={visualizer.setPdfFormat}
        t={visualizer.t}
      />
    </div>
  );
}
