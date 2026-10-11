import { WidgetCard } from "@/components/ui/WidgetCard";
import { WidgetChartHeader } from "@/components/ui/WidgetChartHeader";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/config/routes";
import { useBrandedDashboardChartColors } from "@/components/dashboard-widgets/useBrandedDashboardChartColors";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { Tooltip, ComposedChart, Area, Line, Bar, Cell, XAxis, YAxis } from "recharts";
import { SafeResponsiveContainer } from "@/components/ui/SafeResponsiveContainer";
import { ChartGrid, chartAxisTick } from "@/components/ui/ChartGrid";
import { useTranslation } from "@/hooks/useTranslation";
import { useAttendanceRecordsCollection } from "@/tenant/hooks/collections/attendance";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import {
  buildWeeklyAttendancePoints,
  type AttendancePoint,
} from "@/components/dashboard-widgets/charts/attendanceChartData";
import { ChartPrefsControlGroup } from "@/components/dashboard-widgets/charts/ChartPrefsControlGroup";
import {
  buildChartTooltip,
  ChartAreaGradient,
  CHART_AXIS_LINE_PROPS,
} from "@/components/dashboard-widgets/charts/chartPrimitives";
import {
  DASHBOARD_CHART_TYPE_OPTIONS,
  ATTENDANCE_CHART_COLOR_OPTIONS,
  type DashboardChartType,
} from "@mms/shared";

const AttTooltip = buildChartTooltip({ valueFormatter: (value) => `${value}%` });

/**
 * AttendanceChart component.
 * Displays weekly attendance rate with dynamic layouts.
 */
export function AttendanceChart({ isEditMode = false }: { isEditMode?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { attendance: ATTENDANCE_COLORS } = useBrandedDashboardChartColors();
  const palette = useBrandPalette();
  const attendanceRecords = useAttendanceRecordsCollection();

  const {
    attendanceChartType: chartType,
    attendanceChartColor: colorTheme,
    updatePref,
  } = useDashboardConfig();

  const attendanceData: AttendancePoint[] = (() =>
    buildWeeklyAttendancePoints(attendanceRecords))();

  const avg = (() => {
    return attendanceData.length
      ? Math.round(
          attendanceData.reduce((sum, attendancePoint) => sum + attendancePoint.rate, 0) /
            attendanceData.length,
        )
      : 0;
  })();

  const isSemantic = colorTheme === "semantic";
  const themeColor = ATTENDANCE_COLORS[colorTheme] || ATTENDANCE_COLORS.brand;
  const semanticBarFill = (rate: number): string => {
    if (rate >= 90) return palette.primary;
    if (rate >= 80) return palette.secondary;
    return palette.charts[0];
  };

  return (
    <WidgetCard ariaLabelledby="attendance-chart-heading" accentColor="primary" className="p-5">
      <WidgetChartHeader
        headingId="attendance-chart-heading"
        title={t("widget.title.attendanceRate")}
        subtitle={t("dashboard.charts.attendance.subtitle")}
        actions={
          <>
            {isEditMode && (
              <ChartPrefsControlGroup
                chartTypeValue={chartType}
                chartTypeOptions={DASHBOARD_CHART_TYPE_OPTIONS}
                onChartTypeChange={(value) => {
                  updatePref("attendanceChartType", value as DashboardChartType);
                }}
                colorValue={colorTheme}
                colorOptions={ATTENDANCE_CHART_COLOR_OPTIONS}
                onColorChange={(value) => {
                  updatePref("attendanceChartColor", value);
                }}
              />
            )}
            <div className="text-end select-none">
              <p className="text-lg font-black text-foreground m-0 tabular-nums">{avg}%</p>
              <p className="text-xs text-muted-foreground mt-0.5 m-0 font-medium">
                {t("dashboard.charts.attendance.weeklyAvg")}
              </p>
            </div>
          </>
        }
      />

      <SafeResponsiveContainer height={170}>
        <ComposedChart
          data={attendanceData}
          margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
          onClick={() => {
            if (!isEditMode) {
              navigate(ROUTES.attendance);
            }
          }}
          className={isEditMode ? "cursor-default" : "cursor-pointer"}
        >
          <defs>
            <ChartAreaGradient id="attGrad" color={themeColor} />
          </defs>
          <ChartGrid vertical={false} />
          <XAxis dataKey="day" tick={chartAxisTick(11, true)} {...CHART_AXIS_LINE_PROPS} />
          <YAxis
            domain={[60, 100]}
            tick={chartAxisTick(11, true)}
            {...CHART_AXIS_LINE_PROPS}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<AttTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />

          {chartType === "area" && (
            <Area
              type="monotone"
              dataKey="rate"
              stroke={themeColor}
              strokeWidth={2.5}
              fill="url(#attGrad)"
              activeDot={{ r: 5, fill: themeColor, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            />
          )}

          {chartType === "line" && (
            <Line
              type="monotone"
              dataKey="rate"
              stroke={themeColor}
              strokeWidth={2.5}
              dot={{ r: 3, fill: themeColor }}
              activeDot={{ r: 5, fill: themeColor, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            />
          )}

          {chartType === "bar" && (
            <Bar dataKey="rate" radius={[5, 5, 0, 0]} maxBarSize={32}>
              {attendanceData.map((attendancePoint, index) => (
                <Cell
                  key={index}
                  fill={isSemantic ? semanticBarFill(attendancePoint.rate) : themeColor}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          )}
        </ComposedChart>
      </SafeResponsiveContainer>
    </WidgetCard>
  );
}
