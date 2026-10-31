import { SectionCard } from "@/components/app/SectionCard";
import { ProgressBar } from "@/components/app/ProgressBar";
import { ReportChartCard } from "@/tenant/components/moduleReports";
import { Alert } from "@/components/app/Alert";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarAngleAxis,
  Radar,
  LineChart,
  Line,
} from "recharts";
import {
  CHART_TEXT_MIN_PX,
  ChartGrid,
  ChartPolarGrid,
  chartAxisTick,
} from "@/components/app/ChartGrid";
import { AlertTriangle, Trophy } from "lucide-react";
import {
  QUESTION_ACCURACY_EXCELLENT_THRESHOLD,
  QUESTION_ACCURACY_WEAK_THRESHOLD,
  questionAccuracyBarClass,
  questionAccuracyTextClass,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";
import type { CategoryPerformance, StudentStatItem } from "../lib/performanceAnalyticsUtils";
import { StudentLeaderboardSection } from "./StudentLeaderboardSection";

export interface PerformanceAnalyticsPanelsProps {
  weakAreas: CategoryPerformance[];
  trendData: Array<{ name: string; avg: number }>;
  radarData: Array<{ subject: string; accuracy: number }>;
  studentStats: StudentStatItem[];
  diffData: Array<{ name: string; accuracy: number }>;
  catPerformance: CategoryPerformance[];
}

export function PerformanceAnalyticsPanels({
  weakAreas,
  trendData,
  radarData,
  studentStats,
  diffData,
  catPerformance,
}: PerformanceAnalyticsPanelsProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {weakAreas.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <Alert
            title={t("questionBank.analytics.weakAreas")}
            className="items-start p-4"
            role="alert"
          >
            <div className="mt-3 flex flex-wrap gap-2.5" role="list">
              {weakAreas.map((categoryResult) => (
                <div
                  key={categoryResult.name}
                  className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-card px-2.5 py-1.5"
                  role="listitem"
                >
                  <span className="text-base" aria-hidden>
                    {categoryResult.icon}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-warning m-0">{categoryResult.name}</p>
                    <p className="text-xs text-warning m-0">
                      {t("questionBank.analytics.accuracy", { percent: categoryResult.accuracy })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Alert>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportChartCard
          accentColor="primary"
          title={t("questionBank.analytics.classTrend")}
          heightClass="h-chart-sm"
        >
          <LineChart data={trendData}>
            <ChartGrid />
            <XAxis dataKey="name" tick={chartAxisTick(10)} />
            <YAxis domain={[0, 100]} tick={chartAxisTick(10)} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              formatter={(v) => [`${v}%`, t("questionBank.analytics.tooltipAvgScore")]}
              contentStyle={{ fontSize: CHART_TEXT_MIN_PX, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 4, fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ReportChartCard>

        <ReportChartCard
          accentColor="info"
          title={t("questionBank.analytics.categoryAccuracy")}
          heightClass="h-chart-sm"
          empty={radarData.length < 3}
          emptyNode={
            <div
              className="flex h-chart-sm items-center justify-center text-sm text-muted-foreground"
              role="status"
            >
              {t("questionBank.analytics.radarInsufficient")}
            </div>
          }
        >
          <RadarChart data={radarData}>
            <ChartPolarGrid />
            <PolarAngleAxis dataKey="subject" tick={chartAxisTick(9)} />
            <Radar
              dataKey="accuracy"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Tooltip
              formatter={(v) => [`${v}%`, t("questionBank.analytics.tooltipAccuracy")]}
              contentStyle={{ fontSize: CHART_TEXT_MIN_PX, borderRadius: 8 }}
            />
          </RadarChart>
        </ReportChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportChartCard
          accentColor="success"
          title={t("questionBank.analytics.studentPerformance")}
          heightClass="h-chart-sm"
        >
          <BarChart data={studentStats} layout="vertical">
            <ChartGrid horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={chartAxisTick(10)}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis type="category" dataKey="name" tick={chartAxisTick(10)} width={90} />
            <Tooltip
              formatter={(v) => [`${v}%`, t("questionBank.analytics.tooltipAvg")]}
              contentStyle={{ fontSize: CHART_TEXT_MIN_PX, borderRadius: 8 }}
            />
            <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ReportChartCard>

        <ReportChartCard
          accentColor="warning"
          title={t("questionBank.analytics.difficultyBreakdown")}
          heightClass="h-chart-sm"
        >
          <BarChart data={diffData}>
            <ChartGrid />
            <XAxis dataKey="name" tick={chartAxisTick(11)} />
            <YAxis domain={[0, 100]} tick={chartAxisTick(10)} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              formatter={(v) => [`${v}%`, t("questionBank.analytics.tooltipAccuracy")]}
              contentStyle={{ fontSize: CHART_TEXT_MIN_PX, borderRadius: 8 }}
            />
            <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} fill="hsl(var(--chart-1))" />
          </BarChart>
        </ReportChartCard>
      </div>

      <SectionCard
        accentColor="info"
        title={t("questionBank.analytics.categoryBreakdown")}
        padding={false}
      >
        <div className={cn("divide-y divide-border/50", CARD_STRIPE_INSET)} role="list">
          {catPerformance
            .sort((a, b) => a.accuracy - b.accuracy)
            .map((categoryResult) => (
              <div
                key={categoryResult.name}
                className="flex items-center gap-4 px-4 py-3"
                role="listitem"
              >
                <span className="flex-shrink-0 text-xl" aria-hidden>
                  {categoryResult.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {categoryResult.name}
                    </p>
                    <span
                      className={`shrink-0 text-xs font-bold ${questionAccuracyTextClass(categoryResult.accuracy)}`}
                    >
                      {categoryResult.accuracy}%
                    </span>
                  </div>
                  <ProgressBar
                    value={categoryResult.accuracy}
                    fillClassName={questionAccuracyBarClass(categoryResult.accuracy)}
                    trackClassName="bg-border"
                    aria-hidden="true"
                  />
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("questionBank.analytics.correctRatio", {
                      correct: categoryResult.correct,
                      total: categoryResult.total,
                    })}
                  </p>
                </div>
                {categoryResult.accuracy < QUESTION_ACCURACY_WEAK_THRESHOLD && (
                  <AlertTriangle
                    className="h-4 w-4 flex-shrink-0 text-warning"
                    aria-label={t("questionBank.analytics.lowPerformanceWarning")}
                  />
                )}
                {categoryResult.accuracy >= QUESTION_ACCURACY_EXCELLENT_THRESHOLD && (
                  <Trophy
                    className="h-4 w-4 flex-shrink-0 text-warning"
                    aria-label={t("questionBank.analytics.highPerformanceAward")}
                  />
                )}
              </div>
            ))}
        </div>
      </SectionCard>

      <StudentLeaderboardSection studentStats={studentStats} />
    </div>
  );
}
