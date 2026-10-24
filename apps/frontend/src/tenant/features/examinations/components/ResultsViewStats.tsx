import React from "react";
import { Card } from "@/components/ui/card";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { ResultsViewStatsData } from "@/tenant/features/examinations/lib/resultsViewTypes";

export interface ResultsViewStatsProps {
  stats: ResultsViewStatsData;
  t: TranslationFunction;
}

export function ResultsViewStats({ stats, t }: ResultsViewStatsProps): React.JSX.Element {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      role="status"
      aria-label={t("examinations.resultsStats")}
    >
      {[
        { label: t("examinations.stats.students"), value: stats.total },
        { label: t("examinations.stats.classAvg"), value: `${stats.average}%` },
        { label: t("examinations.stats.passed"), value: stats.passed },
        { label: t("examinations.stats.failed"), value: stats.failed },
      ].map((stat) => (
        <Card accentColor="primary" key={stat.label} className="p-3.5 text-center">
          <p className="text-xl font-bold text-foreground leading-none">{stat.value}</p>
          <p className="text-xs text-muted-foreground mt-1.5 mb-0">{stat.label}</p>
        </Card>
      ))}
    </div>
  );
}
