import React from "react";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableCellLink } from "@/components/ui/TableCellLink";
import { useTranslation } from "@/hooks/useTranslation";

import type { ClassRankingItem } from "./academicReportTypes";

interface AcademicReportClassRankingsProps {
  classRankings: ClassRankingItem[];
  onToggleClassFilter: (className: string) => void;
}

export const AcademicReportClassRankings = function AcademicReportClassRankings({
  classRankings,
  onToggleClassFilter,
}: AcademicReportClassRankingsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <p className="text-sm font-semibold text-foreground">
        {t("examinations.report.classRankings")}
      </p>
      {classRankings.length === 0 ? (
        <EmptyState icon={Trophy} title={t("examinations.report.noClassRankingData")} compact />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {classRankings.map((classRanking, index) => (
            <Card key={classRanking.class} className="p-5">
              <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                <TableCellLink
                  tap
                  onClick={() => onToggleClassFilter(classRanking.class)}
                  className="min-w-0 flex-1 justify-start truncate"
                >
                  {classRanking.class}
                </TableCellLink>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  #{index + 1}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("examinations.report.topStudentLabel")}:{" "}
                <span className="font-semibold text-foreground">{classRanking.topStudent}</span> (
                {classRanking.topMarks}%)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("examinations.report.classAvg")}:{" "}
                <span className="font-semibold">{classRanking.averageMarks}%</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t("examinations.report.passRate")}:{" "}
                <span className="font-semibold text-success">{classRanking.passRate}%</span>
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};
