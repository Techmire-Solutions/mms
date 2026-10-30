import React from "react";
import { WidgetCard } from "@/components/app/WidgetCard";
import { WidgetChartHeader } from "@/components/app/WidgetChartHeader";
import { ProgressBar } from "@/components/app/ProgressBar";
import { LegendChip } from "@/components/app/LegendChip";
import { formatNumber, formatPercent } from "@mms/shared";
import { ChartPrefsControlGroup } from "@/components/dashboard-widgets/charts/ChartPrefsControlGroup";
import { HasanatChartPlot } from "@/components/dashboard-widgets/charts/HasanatChartPlot";
import { ChartEmptyState } from "@/components/dashboard-widgets/charts/ChartEmptyState";
import { useHasanatChartData } from "@/components/dashboard-widgets/charts/useHasanatChartData";
import {
  DASHBOARD_HASANAT_CHART_TYPE_OPTIONS,
  HASANAT_CHART_COLOR_OPTIONS,
  type HasanatChartType,
} from "@mms/shared";

export function HasanatChart({ isEditMode = false }: { isEditMode?: boolean }): React.JSX.Element {
  const { t, chartType, colorTheme, updatePref, hasanatData, total, activeColors } =
    useHasanatChartData();

  return (
    <WidgetCard ariaLabelledby="hasanat-chart-heading" accentColor="warning" className="p-5">
      <WidgetChartHeader
        headingId="hasanat-chart-heading"
        title={t("widget.title.hasanatDistribution")}
        subtitle={t("dashboard.charts.hasanat.subtitle")}
        actions={
          <>
            {isEditMode && (
              <ChartPrefsControlGroup
                chartTypeValue={chartType}
                chartTypeOptions={DASHBOARD_HASANAT_CHART_TYPE_OPTIONS}
                onChartTypeChange={(value) => {
                  updatePref("hasanatChartType", value as HasanatChartType);
                }}
                colorValue={colorTheme}
                colorOptions={HASANAT_CHART_COLOR_OPTIONS}
                onColorChange={(value) => {
                  updatePref("hasanatChartColor", value);
                }}
              />
            )}
            <p className="text-lg font-black text-foreground m-0 select-none tabular-nums">
              {formatNumber(total)}
            </p>
          </>
        }
      />

      {total <= 0 ? (
        <ChartEmptyState height={170} />
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4 min-h-card-sm">
          <HasanatChartPlot
            chartType={chartType}
            hasanatData={hasanatData}
            activeColors={activeColors}
          />

          <div className="flex-1 w-full space-y-2 text-start">
            {hasanatData.map((hasanatPoint) => {
              const percentage = total > 0 ? ((hasanatPoint.value / total) * 100).toFixed(0) : "0";
              return (
                <div
                  key={hasanatPoint.name}
                  aria-label={`${hasanatPoint.name}: ${formatPercent(percentage)}`}
                >
                  <div className="mb-1 select-none">
                    <LegendChip
                      dotStyle={{ background: hasanatPoint.color }}
                      label={
                        <span className="min-w-0 truncate text-muted-foreground">
                          {hasanatPoint.name}
                        </span>
                      }
                      value={formatPercent(percentage)}
                      valueClassName="font-semibold text-foreground"
                    />
                  </div>
                  <ProgressBar
                    value={Number(percentage)}
                    fillStyle={{ background: hasanatPoint.color }}
                    trackClassName="h-1"
                    aria-hidden="true"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
