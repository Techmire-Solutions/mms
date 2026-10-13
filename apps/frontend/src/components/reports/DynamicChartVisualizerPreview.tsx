import React from "react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { DynamicChartVisualizerChart } from "@/components/reports/DynamicChartVisualizerChart";
import {
  VisualizerDataMatrix,
  VisualizerKpiCards,
} from "@/components/reports/DynamicChartVisualizerPreviewSections";
import { VisualizerPreviewHeader } from "@/components/reports/DynamicChartVisualizerPreviewHeader";
import type {
  AggregatedItem,
  ChartOperation,
  ChartType,
  CollectionMeta,
} from "@/components/reports/dynamicChartVisualizerTypes";

export interface DynamicChartVisualizerPreviewProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  collectionKey: string;
  chartType: ChartType;
  xAxisField: string;
  operation: ChartOperation;
  activeMeta: CollectionMeta;
  processedData: AggregatedItem[];
  currentColors: string[];
  showGrid: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  showDataTable: boolean;
  showPdfSettings: boolean;
  pdfOrientation: "p" | "l";
  pdfFormat: string;
  containerWidth: number;
  axisFontSize: number;
  legendFontSize: number;
  tickGap: number;
  isPinned: boolean;
  canPin: boolean;
  onSaveVisual?: () => void;
  onClose?: () => void;
  onTogglePin: () => void;
  onExportPng: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onToggleDataTable: () => void;
  onTogglePdfSettings: () => void;
  onPdfOrientationChange: (value: "p" | "l") => void;
  onPdfFormatChange: (value: string) => void;
  t: TranslationFunction;
}

export function DynamicChartVisualizerPreview({
  chartRef,
  title,
  collectionKey,
  chartType,
  xAxisField,
  operation,
  activeMeta,
  processedData,
  currentColors,
  showGrid,
  showLegend,
  showTooltip,
  showDataTable,
  showPdfSettings,
  pdfOrientation,
  pdfFormat,
  containerWidth,
  axisFontSize,
  legendFontSize,
  tickGap,
  isPinned,
  canPin,
  onSaveVisual,
  onClose,
  onTogglePin,
  onExportPng,
  onExportExcel,
  onExportPdf,
  onToggleDataTable,
  onTogglePdfSettings,
  onPdfOrientationChange,
  onPdfFormatChange,
  t,
}: DynamicChartVisualizerPreviewProps): React.JSX.Element {
  return (
    <div className="lg:col-span-7 space-y-5">
      <div className={`${WORK_SURFACE} p-6 space-y-6`}>
        <VisualizerPreviewHeader
          title={title}
          collectionKey={collectionKey}
          xAxisField={xAxisField}
          activeMeta={activeMeta}
          showPdfSettings={showPdfSettings}
          pdfOrientation={pdfOrientation}
          pdfFormat={pdfFormat}
          isPinned={isPinned}
          canPin={canPin}
          onSaveVisual={onSaveVisual}
          onClose={onClose}
          onTogglePin={onTogglePin}
          onExportPng={onExportPng}
          onExportExcel={onExportExcel}
          onExportPdf={onExportPdf}
          onTogglePdfSettings={onTogglePdfSettings}
          onPdfOrientationChange={onPdfOrientationChange}
          onPdfFormatChange={onPdfFormatChange}
          t={t}
        />

        <div
          ref={chartRef}
          className="relative overflow-hidden rounded-3xl border border-border/30 bg-card/5 p-4 shadow-inner backdrop-blur-md"
        >
          <DynamicChartVisualizerChart
            chartType={chartType}
            operation={operation}
            processedData={processedData}
            currentColors={currentColors}
            showGrid={showGrid}
            showLegend={showLegend}
            showTooltip={showTooltip}
            containerWidth={containerWidth}
            axisFontSize={axisFontSize}
            legendFontSize={legendFontSize}
            tickGap={tickGap}
            t={t}
          />
        </div>

        <VisualizerKpiCards processedData={processedData} t={t} />
        <VisualizerDataMatrix
          showDataTable={showDataTable}
          processedData={processedData}
          operation={operation}
          onToggleDataTable={onToggleDataTable}
          t={t}
        />
      </div>
    </div>
  );
}
