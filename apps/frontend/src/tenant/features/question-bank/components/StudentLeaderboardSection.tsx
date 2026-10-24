import type React from "react";
import { Trophy } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { ProgressBar } from "@/components/app/ProgressBar";
import { ExportToolbar } from "@/components/app/ExportToolbar";
import { useTranslation } from "@/hooks/useTranslation";
import type { StudentStatItem } from "../lib/performanceAnalyticsUtils";

export interface StudentLeaderboardSectionProps {
  studentStats: StudentStatItem[];
}

export function StudentLeaderboardSection({
  studentStats,
}: StudentLeaderboardSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (studentStats.length === 0) return null;

  return (
    <SectionCard
      accentColor="emerald"
      title={t("questionBank.analytics.studentLeaderboard")}
      icon={Trophy}
      actions={
        <ExportToolbar
          title={t("questionBank.analytics.studentLeaderboard")}
          moduleId="question-bank"
          filename="student_performance_leaderboard"
          columns={[
            { key: "rank", header: t("examinations.report.colRank") },
            { key: "name", header: t("examinations.report.colStudent") },
            { key: "class", header: t("examinations.report.colClass") },
            { key: "avg", header: t("examinations.report.colMarks") },
            { key: "overall", header: t("examinations.report.colGrade") },
          ]}
          rows={studentStats.map((studentStat, index) => ({
            rank: index + 1,
            name: studentStat.name,
            class: studentStat.class,
            avg: `${studentStat.avg}%`,
            overall: `${studentStat.overall}%`,
          }))}
        />
      }
    >
      <div className="space-y-2.5" role="list">
        {studentStats.map((studentStat, studentIndex) => (
          <div key={studentStat.name} className="flex items-center gap-3" role="listitem">
            <span className="w-6 flex-shrink-0 text-sm font-bold text-muted-foreground">
              {studentIndex + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex min-w-0 items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {studentStat.name}{" "}
                  <span className="font-normal text-muted-foreground">· {studentStat.class}</span>
                </p>
                <p className="shrink-0 text-sm font-bold text-foreground">{studentStat.avg}%</p>
              </div>
              <ProgressBar
                value={studentStat.avg}
                fillClassName="bg-primary"
                trackClassName="bg-border"
                aria-hidden="true"
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
