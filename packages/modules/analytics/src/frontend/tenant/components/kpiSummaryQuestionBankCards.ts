import { CalendarCheck, BarChart2, Target, UserCheck } from "lucide-react";
import type {
  QuestionBankCommandMetricsSnapshot,
  QuestionBankQuestion,
  QuestionBankResult,
  QuestionBankTest,
} from "@mms/contracts";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import type { CategorizedKPIItem } from "./kpiSummaryTypes";

interface BuildQuestionBankKPICardsOptions {
  questionBankMetrics?: QuestionBankCommandMetricsSnapshot;
  questionBankQuestions: QuestionBankQuestion[];
  questionBankTests: QuestionBankTest[];
  questionBankResults: QuestionBankResult[];
  t: TranslationFunction;
}

export function buildQuestionBankKPICards({
  questionBankMetrics,
  questionBankQuestions,
  questionBankTests,
  questionBankResults,
  t,
}: BuildQuestionBankKPICardsOptions): {
  cards: CategorizedKPIItem[];
  questionBankTotalMax: number;
} {
  const totalQuestions = questionBankMetrics?.total ?? questionBankQuestions.length;
  const totalTests = questionBankMetrics?.totalTests ?? questionBankTests.length;
  const totalResults = questionBankMetrics?.totalResults ?? questionBankResults.length;

  let questionBankTotalObtained = 0;
  let questionBankTotalMax = 0;
  questionBankResults.forEach((result: any) => {
    const test = questionBankTests.find((option: any) => option.id === result.testId);
    if (!test) return;
    questionBankTotalObtained += Object.values(
      ((result.scores as any) ?? {}) as Record<string, any>,
    ).reduce((sum: any, score: any) => sum + (typeof score === "number" ? score : 0), 0);
    questionBankTotalMax += test.questionIds.reduce((sum: any, questionId: any) => {
      const question = questionBankQuestions.find((option: any) => option.id === questionId);
      return sum + (question?.marks ?? 0);
    }, 0);
  });
  const averageQuestionBankScore =
    questionBankTotalMax > 0
      ? `${Math.round((questionBankTotalObtained / questionBankTotalMax) * 100)}%`
      : "0%";

  return {
    questionBankTotalMax,
    cards: [
      {
        id: "kpi-total-questions",
        icon: BarChart2,
        label: t("reports.kpi.totalQuestions"),
        value: String(totalQuestions),
        sub: t("reports.kpi.sub.inQuestionBank"),
        color: "primary",
        trend: "flat",
        categories: ["questionBank"],
        isAvailable: totalQuestions > 0,
      },
      {
        id: "kpi-generated-tests",
        icon: CalendarCheck,
        label: t("reports.kpi.generatedTests"),
        value: String(totalTests),
        sub: t("reports.kpi.sub.autoBuiltPapers"),
        color: "info",
        trend: "flat",
        categories: ["questionBank"],
        isAvailable: totalTests > 0,
      },
      {
        id: "kpi-test-submissions",
        icon: UserCheck,
        label: t("reports.kpi.testSubmissions"),
        value: String(totalResults),
        sub: t("reports.kpi.sub.gradedAttempts"),
        color: "secondary",
        trend: "flat",
        categories: ["questionBank"],
        isAvailable: totalResults > 0,
      },
      {
        id: "kpi-avg-test-score",
        icon: Target,
        label: t("reports.kpi.avgTestScore"),
        value: averageQuestionBankScore,
        sub: t("reports.kpi.sub.acrossSubmissions"),
        color: "success",
        trend: "flat",
        categories: ["questionBank"],
        isAvailable: questionBankResults.length > 0 && questionBankTotalMax > 0,
      },
    ],
  };
}
