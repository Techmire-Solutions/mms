import React from "react";
import { CheckCircle2, XCircle, Clock, Award } from "lucide-react";
import type { QuestionBankQuestion as Question, QuestionBankTest } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import {
  testTotalMarks,
  type StatsSummary,
} from "@/tenant/features/question-bank/components/autoGradingShared";

interface AutoGradingStatsProps {
  stats: StatsSummary;
  test: QuestionBankTest;
  questions: Question[];
  submittedCount: number;
}

export function AutoGradingStats({
  stats,
  test,
  questions,
  submittedCount,
}: AutoGradingStatsProps): React.ReactElement {
  const { t } = useTranslation();
  const totalMarks = testTotalMarks(test, questions) || 100;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="status">
      {[
        {
          label: t("questionBank.grading.submitted"),
          value: submittedCount,
          icon: Clock,
          cls: "text-primary",
        },
        {
          label: t("questionBank.grading.classAvg"),
          value: `${stats.avg}%`,
          icon: Award,
          cls: "text-warning",
        },
        {
          label: t("questionBank.grading.highest"),
          value: `${stats.highest}/${totalMarks}`,
          icon: CheckCircle2,
          cls: "text-success",
        },
        {
          label: t("questionBank.grading.lowest"),
          value: `${stats.lowest}/${totalMarks}`,
          icon: XCircle,
          cls: "text-destructive",
        },
      ].map((statCard) => {
        const Icon = statCard.icon;
        return (
          <div key={statCard.label} className={`${WORK_SURFACE_INNER} p-3.5`}>
            <Icon className={`mb-1.5 h-4 w-4 ${statCard.cls}`} aria-hidden />
            <p className="text-lg font-bold text-foreground m-0">{statCard.value}</p>
            <p className="text-xs text-muted-foreground m-0">{statCard.label}</p>
          </div>
        );
      })}
    </div>
  );
}
