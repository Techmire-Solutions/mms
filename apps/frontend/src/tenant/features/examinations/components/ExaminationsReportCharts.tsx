import React from "react";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import { useExaminationsReportAggregates } from "../hooks/useExaminationsReportAggregates";

/**
 * Reports-tab analytics, rendered from the server aggregates.
 *
 * These numbers used to be reduced in the browser from a marks page capped at 10,000 rows, so a
 * large tenant silently saw truncated pass rates and distributions. The endpoint is the same one
 * ComparisonMode uses; the charts are plain bars so no chart runtime is loaded on this tier.
 */

function BarRow({
  label,
  value,
  max,
  caption,
}: {
  label: string;
  value: number;
  max: number;
  caption: string;
}): React.JSX.Element {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{caption}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${label}: ${caption}`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

export function ExaminationsReportCharts(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { data } = useExaminationsReportAggregates();
  const analytics = data?.analytics;
  const top = analytics?.topPerformers ?? [];
  const { data: students = [] } = useStudentsByIds(top.map((entry) => entry.studentId));
  const names = new Map(
    students.map((student: { id?: string | number; name?: string }) => [
      String(student.id),
      student.name ?? "",
    ]),
  );

  if (!analytics) return null;
  const hasData =
    analytics.subjectPassRates.length > 0 ||
    analytics.gradeDistribution.some((bucket) => bucket.count > 0) ||
    top.length > 0 ||
    analytics.sectionAverages.length > 0;

  if (!hasData) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {t("examinations.analytics.noData")}
      </Card>
    );
  }

  const maxGrade = Math.max(1, ...analytics.gradeDistribution.map((bucket) => bucket.count));

  return (
    <section aria-label={t("examinations.analytics.title")} className="space-y-4">
      <h2 className="m-0 text-sm font-bold text-foreground">{t("examinations.analytics.title")}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-bold text-foreground">
            {t("examinations.analytics.subjectPassRates")}
          </h3>
          <ul className="m-0 space-y-2 p-0">
            {analytics.subjectPassRates.map((row) => (
              <BarRow
                key={row.subject}
                label={row.subject}
                value={row.passRatePct}
                max={100}
                caption={`${row.passRatePct}% · ${row.passed}/${row.total}`}
              />
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-bold text-foreground">
            {t("examinations.analytics.gradeDistribution")}
          </h3>
          <ul className="m-0 space-y-2 p-0">
            {analytics.gradeDistribution.map((bucket) => (
              <BarRow
                key={bucket.grade}
                label={bucket.grade}
                value={bucket.count}
                max={maxGrade}
                caption={t("examinations.analytics.studentsCount", { count: bucket.count })}
              />
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-bold text-foreground">
            {t("examinations.analytics.topPerformers")}
          </h3>
          <ol className="m-0 list-decimal space-y-1 ps-5 text-sm">
            {top.map((entry) => (
              <li key={entry.studentId} className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground">
                  {names.get(entry.studentId) || entry.studentId}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {entry.averagePct}% ·{" "}
                  {t("examinations.analytics.examsCount", { count: entry.exams })}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-bold text-foreground">
            {t("examinations.analytics.sectionAverages")}
          </h3>
          <ul className="m-0 space-y-2 p-0">
            {analytics.sectionAverages.map((row) => (
              <BarRow
                key={row.label}
                label={row.label}
                value={row.averagePct}
                max={100}
                caption={`${row.averagePct}% · ${t("examinations.analytics.studentsCount", {
                  count: row.total,
                })}`}
              />
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
