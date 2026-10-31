import { useState } from "react";
import { WidgetCard } from "@/components/app/WidgetCard";
import { WidgetChartHeader } from "@/components/app/WidgetChartHeader";
import { CompactSegmentedControl } from "@/components/app/CompactSegmentedControl";
import { useBrandedDashboardChartColors } from "@/components/dashboard-widgets/useBrandedDashboardChartColors";
import { ChartPrefsControlGroup } from "@/components/dashboard-widgets/charts/ChartPrefsControlGroup";
import { useTranslation } from "@/hooks/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useRevenueChartData } from "@/components/dashboard-widgets/charts/useRevenueChartData";
import { LegendChip } from "@/components/app/LegendChip";
import { RevenueChartPlot } from "@/components/dashboard-widgets/charts/RevenueChartPlot";
import { ChartEmptyState } from "@/components/dashboard-widgets/charts/ChartEmptyState";
import {
  DASHBOARD_CHART_TYPE_OPTIONS,
  REVENUE_CHART_COLOR_OPTIONS,
  type DashboardChartType,
} from "@mms/shared";

export default function RevenueChart({ isEditMode = false }: { isEditMode?: boolean }) {
  const { t } = useTranslation();
  const { revenue: COLOR_THEMES } = useBrandedDashboardChartColors();
  const [period, setPeriod] = useState<"6m" | "10m">("10m");
  const { revenueData } = useRevenueChartData();

  const {
    revenueChartType: chartType,
    revenueChartColor: colorTheme,
    updatePref,
  } = useDashboardConfig();

  const visibleRevenueData = period === "6m" ? revenueData.slice(-6) : revenueData;
  const hasRevenueData = visibleRevenueData.some(
    (point) => point.revenue !== 0 || point.expenses !== 0,
  );
  const activeColors = COLOR_THEMES[colorTheme] || COLOR_THEMES.mixed;

  return (
    <WidgetCard ariaLabelledby="revenue-chart-heading" accentColor="primary" className="p-5">
      <WidgetChartHeader
        headingId="revenue-chart-heading"
        title={t("widget.title.revenueExpenses")}
        subtitle={t("dashboard.charts.revenue.subtitle")}
        actions={
          <>
            {isEditMode && (
              <ChartPrefsControlGroup
                chartTypeValue={chartType}
                chartTypeOptions={DASHBOARD_CHART_TYPE_OPTIONS}
                onChartTypeChange={(chartTypeValue) => {
                  updatePref("revenueChartType", chartTypeValue as DashboardChartType);
                }}
                colorValue={colorTheme}
                colorOptions={REVENUE_CHART_COLOR_OPTIONS}
                onColorChange={(selectedColorTheme) => {
                  updatePref("revenueChartColor", selectedColorTheme);
                }}
              />
            )}
            <CompactSegmentedControl
              tone="card"
              className="bg-muted/65 rounded-lg p-0.5 border-border/50"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "6m", label: "6m" },
                { value: "10m", label: "10m" },
              ]}
            />
          </>
        }
      />

      {!hasRevenueData ? (
        <ChartEmptyState height={210} />
      ) : (
        <>
          <div className="flex items-center gap-4 mb-4" aria-hidden="true">
            <LegendChip
              dotStyle={{ backgroundColor: activeColors.revenue }}
              label={
                <span className="text-muted-foreground">{t("accounting.dashboard.revenue")}</span>
              }
            />
            <LegendChip
              dotStyle={{ backgroundColor: activeColors.expenses }}
              label={
                <span className="text-muted-foreground">{t("accounting.dashboard.expenses")}</span>
              }
            />
          </div>

          <RevenueChartPlot
            data={visibleRevenueData}
            chartType={chartType}
            activeColors={activeColors}
            isEditMode={isEditMode}
          />
        </>
      )}
    </WidgetCard>
  );
}
