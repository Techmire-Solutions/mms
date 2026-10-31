import { useBrandedDashboardChartColors } from "@/components/dashboard-widgets/useBrandedDashboardChartColors";
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { SafeResponsiveContainer } from "@/components/app/SafeResponsiveContainer";
import { ChartGrid, chartAxisTick } from "@/components/app/ChartGrid";
import { Badge } from "@/components/ui/badge";
import { WidgetCard } from "@/components/app/WidgetCard";
import { WidgetChartHeader } from "@/components/app/WidgetChartHeader";
import { useEnrollmentsReportAggregates } from "@/tenant/hooks/collections/enrollments";
import { TrendingUp } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import {
  buildBucketedSeries,
  formatMonthName,
  formatPercent,
  getRecentMonthsList,
} from "@mms/shared";
import { ChartPrefsControlGroup } from "@/components/dashboard-widgets/charts/ChartPrefsControlGroup";
import { ChartEmptyState } from "@/components/dashboard-widgets/charts/ChartEmptyState";
import {
  buildChartTooltip,
  ChartAreaGradient,
  CHART_AXIS_LINE_PROPS,
} from "@/components/dashboard-widgets/charts/chartPrimitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORM_SELECT_MINI } from "@/components/ui/formStyles";
import {
  DASHBOARD_CHART_TYPE_OPTIONS,
  ENROLLMENT_CHART_COLOR_OPTIONS,
  type DashboardChartType,
  type DashboardPreferences,
} from "@mms/shared";

interface EnrollmentPoint {
  month: string;
  students: number;
}

const CustomTooltip = buildChartTooltip({
  valueFormatter: (value, { t }) => t("dashboard.widgets.studentsCount", { count: value }),
  labelClassName: "text-muted-foreground mb-0.5 font-medium",
});

/**
 * Enrollment Chart — cumulative student growth from report-aggregates.
 */
export default function EnrollmentChart({ isEditMode = false }: { isEditMode?: boolean }) {
  const { t } = useTranslation();
  const { enrollment: COLOR_MAP } = useBrandedDashboardChartColors();
  const { data: reportAggregates } = useEnrollmentsReportAggregates();

  const {
    enrollmentChartType: chartType,
    enrollmentChartColor: colorTheme,
    enrollmentChartPeriod: monthsCount,
    updatePref,
  } = useDashboardConfig();

  const months = (() => getRecentMonthsList(12))();
  const activeMonths = months.slice(-monthsCount);

  const trendsEnvelope = reportAggregates as {
    body?: { cumulativeTrends?: Array<{ monthKey: string; students: number }> };
    cumulativeTrends?: Array<{ monthKey: string; students: number }>;
  } | null;
  const trends = trendsEnvelope?.body?.cumulativeTrends ?? trendsEnvelope?.cumulativeTrends ?? [];
  const hasTrendData = trends.length > 0;
  const enrollmentData: EnrollmentPoint[] = (() => {
    const byKey = new Map<string, number>(
      trends.map((trend) => [trend.monthKey, Number(trend.students) || 0]),
    );
    return buildBucketedSeries(activeMonths, byKey, (month, students) => ({
      month: month.label || formatMonthName(`${month.key}-01`),
      students: students ?? 0,
    }));
  })();

  const start = enrollmentData[0]?.students || 0;
  const end = enrollmentData[enrollmentData.length - 1]?.students || 0;
  const growth = start > 0 ? (((end - start) / start) * 100).toFixed(1) : "0";

  const activeColor = COLOR_MAP[colorTheme] || COLOR_MAP.brand;

  return (
    <WidgetCard ariaLabelledby="enrollment-chart-heading" accentColor="primary" className="p-5">
      <WidgetChartHeader
        headingId="enrollment-chart-heading"
        title={t("widget.title.enrollmentTrends")}
        subtitle={t("dashboard.charts.enrollment.subtitle")}
        actions={
          <>
            {isEditMode && (
              <ChartPrefsControlGroup
                chartTypeValue={chartType}
                chartTypeOptions={DASHBOARD_CHART_TYPE_OPTIONS}
                onChartTypeChange={(value) => {
                  updatePref("enrollmentChartType", value as DashboardChartType);
                }}
                colorValue={colorTheme}
                colorOptions={ENROLLMENT_CHART_COLOR_OPTIONS}
                onColorChange={(value) => {
                  updatePref(
                    "enrollmentChartColor",
                    value as DashboardPreferences["enrollmentChartColor"],
                  );
                }}
              >
                <Select
                  value={String(monthsCount)}
                  onValueChange={(value) => {
                    updatePref("enrollmentChartPeriod", Number(value));
                  }}
                >
                  <SelectTrigger
                    className={FORM_SELECT_MINI}
                    aria-label={t("dashboard.widgets.selectPeriod")}
                  >
                    <SelectValue placeholder={t("dashboard.widgets.selectPeriod")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">
                      {t("dashboard.charts.monthsRange", { count: 3 })}
                    </SelectItem>
                    <SelectItem value="6">
                      {t("dashboard.charts.monthsRange", { count: 6 })}
                    </SelectItem>
                    <SelectItem value="10">
                      {t("dashboard.charts.monthsRange", { count: 10 })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </ChartPrefsControlGroup>
            )}
            <Badge
              pill
              variant="outline"
              className={`gap-1.5 px-2.5 py-1 ${activeColor.bg} ${activeColor.text}`}
              aria-label={`Growth: ${formatPercent(growth)}`}
            >
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              <bdi dir="ltr" className="text-xs font-bold tabular-nums">
                +{formatPercent(growth)}
              </bdi>
            </Badge>
          </>
        }
      />

      {!hasTrendData ? (
        <ChartEmptyState height={200} />
      ) : (
        <SafeResponsiveContainer height={200}>
          <ComposedChart data={enrollmentData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <defs>
              {Object.entries(COLOR_MAP).map(([key, config]) => (
                <ChartAreaGradient key={key} id={`enrollGrad-${key}`} color={config.stop} />
              ))}
            </defs>
            <ChartGrid vertical={false} />
            <XAxis dataKey="month" tick={chartAxisTick(11, true)} {...CHART_AXIS_LINE_PROPS} />
            <YAxis
              tick={chartAxisTick(11, true)}
              {...CHART_AXIS_LINE_PROPS}
              domain={["dataMin - 20", "dataMax + 10"]}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: activeColor.stroke, strokeWidth: 1, strokeDasharray: "4 4" }}
            />

            {chartType === "area" && (
              <Area
                type="monotone"
                dataKey="students"
                stroke={activeColor.stroke}
                strokeWidth={2.5}
                fill={activeColor.fill}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: activeColor.stroke,
                  strokeWidth: 2,
                  stroke: "hsl(var(--card))",
                }}
              />
            )}
            {chartType === "line" && (
              <Line
                type="monotone"
                dataKey="students"
                stroke={activeColor.stroke}
                strokeWidth={2.5}
                dot={{ r: 3, fill: activeColor.stroke }}
                activeDot={{
                  r: 5,
                  fill: activeColor.stroke,
                  strokeWidth: 2,
                  stroke: "hsl(var(--card))",
                }}
              />
            )}
            {chartType === "bar" && (
              <Bar
                dataKey="students"
                fill={activeColor.stroke}
                fillOpacity={0.85}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            )}
          </ComposedChart>
        </SafeResponsiveContainer>
      )}
    </WidgetCard>
  );
}
