import { ReportChartCard } from "@/tenant/components/moduleReports";
import { LegendChip } from "@/components/ui/LegendChip";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ChartGrid, chartAxisTick } from "@/components/ui/ChartGrid";
import type { AttendanceStatus } from "@/lib/data/attendanceData";
import { attendanceStatusLabel } from "@/lib/attendanceStatusUi";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type {
  ClassStatEntry,
  StudentRateEntry,
} from "@/tenant/features/attendance/components/useAttendanceAnalyticsModel";

export interface AttendanceAnalyticsChartPanelsProps {
  t: TranslationFunction;
  colors: string[];
  classStats: ClassStatEntry[];
  monthlyTrend: Array<{ month: string; rate: number }>;
  studentRates: StudentRateEntry[];
  pieData: Array<{ name: string; value: number }>;
  statuses: AttendanceStatus[];
  totalStats: Record<string, number>;
}

export function AttendanceAnalyticsChartPanels({
  t,
  colors,
  classStats,
  monthlyTrend,
  studentRates,
  pieData,
  statuses,
  totalStats,
}: AttendanceAnalyticsChartPanelsProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2, ease: "easeOut" }}
      >
        <ReportChartCard
          title={t("attendance.analytics.charts.classRateTitle")}
          accentColor="primary"
          heightClass="h-chart-sm"
        >
          <BarChart data={classStats} barSize={32}>
            <ChartGrid />
            <XAxis dataKey="name" tick={chartAxisTick(11)} />
            <YAxis domain={[0, 100]} tick={chartAxisTick(11)} unit="%" />
            <Tooltip formatter={(value) => `${value}%`} />
            <Bar
              dataKey="rate"
              name={t("attendance.analytics.attendanceLabel")}
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              label={{
                position: "top",
                fontSize: 10,
                fill: "hsl(var(--muted-foreground))",
                formatter: (value) => (value !== undefined && value !== null ? `${value}%` : ""),
              }}
            />
          </BarChart>
        </ReportChartCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25, ease: "easeOut" }}
      >
        <ReportChartCard
          title={t("attendance.analytics.charts.monthlyTrendTitle")}
          accentColor="info"
          heightClass="h-chart-sm"
        >
          <AreaChart data={monthlyTrend}>
            <defs>
              <linearGradient id="att-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <ChartGrid />
            <XAxis dataKey="month" tick={chartAxisTick(11)} />
            <YAxis domain={[0, 100]} tick={chartAxisTick(11)} unit="%" />
            <Tooltip formatter={(value) => `${value}%`} />
            <Area
              type="monotone"
              dataKey="rate"
              name={t("attendance.analytics.attendancePercentLabel")}
              stroke="hsl(var(--primary))"
              fill="url(#att-grad)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </AreaChart>
        </ReportChartCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3, ease: "easeOut" }}
      >
        <ReportChartCard
          title={t("attendance.analytics.charts.studentRatesTitle")}
          accentColor="info"
          heightClass="h-chart-sm"
        >
          <BarChart data={studentRates} layout="vertical" barSize={12}>
            <XAxis type="number" domain={[0, 100]} tick={chartAxisTick(10)} unit="%" />
            <YAxis dataKey="name" type="category" tick={chartAxisTick(10)} width={80} />
            <Tooltip formatter={(value) => `${value}%`} />
            <Bar
              dataKey="rate"
              name={t("attendance.analytics.rateLabel")}
              radius={[0, 4, 4, 0]}
              fill="hsl(var(--primary))"
              background={{ fill: "hsl(var(--muted))", radius: 4 }}
            />
          </BarChart>
        </ReportChartCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.35, ease: "easeOut" }}
      >
        <ReportChartCard
          title={t("attendance.analytics.charts.statusDistributionTitle")}
          accentColor="primary"
          heightClass="h-chart-sm"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {statuses.map((status, index) => (
                <LegendChip
                  key={status.id}
                  gap="md"
                  dotStyle={{ background: colors[index % colors.length] }}
                  label={attendanceStatusLabel(status, t)}
                  labelClassName="text-muted-foreground"
                  value={totalStats[status.id] || 0}
                />
              ))}
            </div>
          }
        >
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ReportChartCard>
      </motion.div>
    </div>
  );
}
