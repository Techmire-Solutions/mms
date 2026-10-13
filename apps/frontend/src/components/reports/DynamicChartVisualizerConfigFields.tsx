import React from "react";
import {
  CHART_PALETTE_DEFS,
  isColorblindSafeChartPalette,
  type AppTranslationKey,
} from "@mms/shared";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/FormSelect";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Badge } from "@/components/ui/badge";
import { getFieldLabel } from "@/lib/reports/reportMetadata";
import type {
  ChartOperation,
  ChartType,
} from "@/components/ui/reports/dynamicChartVisualizerTypes";
import type { DynamicChartVisualizerConfigPanelProps } from "@/components/ui/reports/dynamicChartVisualizerConfigPanelTypes";
import { DynamicChartVisualizerDisplayFields } from "./DynamicChartVisualizerDisplayFields";

type FieldsProps = Pick<
  DynamicChartVisualizerConfigPanelProps,
  | "title"
  | "setTitle"
  | "collectionKey"
  | "setCollectionKey"
  | "xAxisField"
  | "setXAxisField"
  | "operation"
  | "setOperation"
  | "targetField"
  | "setTargetField"
  | "chartType"
  | "setChartType"
  | "activePalette"
  | "setActivePalette"
  | "showGrid"
  | "setShowGrid"
  | "showLegend"
  | "setShowLegend"
  | "showTooltip"
  | "setShowTooltip"
  | "activeMeta"
  | "metadataConfigs"
  | "t"
>;

export function DynamicChartVisualizerConfigFields({
  title,
  setTitle,
  collectionKey,
  setCollectionKey,
  xAxisField,
  setXAxisField,
  operation,
  setOperation,
  targetField,
  setTargetField,
  chartType,
  setChartType,
  activePalette,
  setActivePalette,
  showGrid,
  setShowGrid,
  showLegend,
  setShowLegend,
  showTooltip,
  setShowTooltip,
  activeMeta,
  metadataConfigs,
  t,
}: FieldsProps): React.JSX.Element {
  return (
    <div className="space-y-3.5">
      <div className="space-y-1">
        <SectionLabel
          as="label"
          htmlFor="chart-title"
          weight="bold"
          tracking="wider"
          className="block"
        >
          {t("reports.visualizer.chartTitleLabel")}
        </SectionLabel>
        <Input
          id="chart-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("reports.visualizer.titlePlaceholder")}
          className="w-full min-h-11 px-3 py-2 text-xs rounded-xl bg-card/50 text-foreground focus:ring-2 focus:ring-primary/20 font-semibold"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <SectionLabel
            as="label"
            htmlFor="chart-collection"
            weight="bold"
            tracking="wider"
            className="block"
          >
            {t("reports.visualizer.dataCollection")}
          </SectionLabel>
          <FormSelect
            id="chart-collection"
            value={collectionKey}
            onChange={(value) => setCollectionKey(value)}
            className="w-full text-xs"
            options={Object.entries(metadataConfigs).map(([metadataKey, metadataConfig]) => {
              const transKey = `reports.collections.${metadataKey}`;
              const translated = t(transKey as AppTranslationKey);
              return {
                value: metadataKey,
                label: translated === transKey ? metadataConfig.name : translated,
              };
            })}
          />
        </div>

        <div className="space-y-1">
          <SectionLabel
            as="label"
            htmlFor="chart-x-axis"
            weight="bold"
            tracking="wider"
            className="block"
          >
            {t("reports.visualizer.xAxisDimension")}
          </SectionLabel>
          <FormSelect
            id="chart-x-axis"
            value={xAxisField}
            onChange={setXAxisField}
            className="w-full text-xs"
            options={activeMeta.fields.map((metadataField) => ({
              value: metadataField.value,
              label: getFieldLabel(metadataField.value, metadataField.label, t),
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <SectionLabel
            as="label"
            htmlFor="chart-operation"
            weight="bold"
            tracking="wider"
            className="block"
          >
            {t("reports.visualizer.operation")}
          </SectionLabel>
          <FormSelect
            id="chart-operation"
            value={operation}
            onChange={(value) => setOperation(value as ChartOperation)}
            className="w-full text-xs"
            options={[
              { value: "count", label: t("reports.visualizer.opCount") },
              ...(activeMeta.numericFields.length > 0
                ? [
                    { value: "sum", label: t("reports.visualizer.opSum") },
                    { value: "avg", label: t("reports.visualizer.opAvg") },
                    { value: "min", label: t("reports.visualizer.opMin") },
                    { value: "max", label: t("reports.visualizer.opMax") },
                  ]
                : []),
            ]}
          />
        </div>

        <div className="space-y-1">
          <SectionLabel
            as="label"
            htmlFor="chart-target-field"
            weight="bold"
            tracking="wider"
            className="block"
          >
            {t("reports.visualizer.targetField")}
          </SectionLabel>
          <FormSelect
            id="chart-target-field"
            disabled={operation === "count"}
            value={targetField}
            onChange={setTargetField}
            className="w-full text-xs"
            options={
              activeMeta.numericFields.length === 0
                ? [{ value: "", label: t("reports.widgets.builder.noNumericFields") }]
                : activeMeta.numericFields.map((numericField) => ({
                    value: numericField.value,
                    label: getFieldLabel(numericField.value, numericField.label, t),
                  }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <SectionLabel
            as="label"
            htmlFor="chart-type"
            weight="bold"
            tracking="wider"
            className="block"
          >
            {t("reports.visualizer.chartType")}
          </SectionLabel>
          <FormSelect
            id="chart-type"
            value={chartType}
            onChange={(value) => setChartType(value as ChartType)}
            className="w-full text-xs"
            options={[
              { value: "bar", label: t("reports.visualizer.chartBar") },
              { value: "line", label: t("reports.visualizer.chartLine") },
              { value: "area", label: t("reports.visualizer.chartArea") },
              { value: "pie", label: t("reports.visualizer.chartPie") },
              { value: "radar", label: t("reports.visualizer.chartRadar") },
            ]}
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <SectionLabel
              as="label"
              htmlFor="chart-palette"
              weight="bold"
              tracking="wider"
              className="block"
            >
              {t("reports.visualizer.colorPalette")}
            </SectionLabel>
            {isColorblindSafeChartPalette(activePalette) && (
              <Badge
                pill
                tone="success"
                className="px-1.5 font-black uppercase tracking-widest leading-none"
              >
                {t("charts.accessibleBadge")}
              </Badge>
            )}
          </div>
          <FormSelect
            id="chart-palette"
            value={activePalette}
            onChange={setActivePalette}
            className="w-full text-xs"
            options={CHART_PALETTE_DEFS.filter(
              (def) => def.id !== "brand" && def.colors.length > 0,
            ).map((def) => ({
              value: def.id,
              label: t(def.labelKey),
            }))}
          />
        </div>
      </div>

      <DynamicChartVisualizerDisplayFields
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showLegend={showLegend}
        setShowLegend={setShowLegend}
        showTooltip={showTooltip}
        setShowTooltip={setShowTooltip}
        t={t}
      />
    </div>
  );
}
