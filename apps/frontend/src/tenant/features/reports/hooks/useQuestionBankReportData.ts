import { useMemo } from "react";
import { getQuestionCategoryIds } from "@mms/shared";
import {
  useQuestionBankQuestions,
  useQuestionBankQuestionsCollection,
  useQuestionBankTests,
  useQuestionBankTestsCollection,
  useQuestionBankResults,
  useQuestionBankResultsCollection,
  useQuestionBankReportAggregates,
  useQuestionBankConfig,
} from "@/tenant/hooks/collections/questionBank";
import { useTranslation } from "@/hooks/useTranslation";
import type { ExportColumn } from "@/components/ui/ExportToolbar";

export interface QuestionBankReportFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  session?: string;
  class?: string;
  student?: string;
}

export interface QuestionBankSummaryRow {
  type: string;
  name: string;
  questions: number;
  tests: number | string;
}

export function useQuestionBankReportData(filters?: QuestionBankReportFilters) {
  const { t } = useTranslation();
  const questionsQuery = useQuestionBankQuestions();
  const testsQuery = useQuestionBankTests();
  const resultsQuery = useQuestionBankResults();
  const aggregatesQuery = useQuestionBankReportAggregates();

  const rawQuestions = useQuestionBankQuestionsCollection();
  const tests = useQuestionBankTestsCollection();
  const results = useQuestionBankResultsCollection();

  const questions = useMemo(() => {
    if (!filters) return rawQuestions;
    let filtered = rawQuestions;
    if (filters.status && filters.status !== "all") {
      filtered = filtered.filter((q) => q.difficulty === filters.status);
    }
    return filtered;
  }, [filters, rawQuestions]);

  const questionBankConfig = useQuestionBankConfig(questions);
  const categories = questionBankConfig.categories;

  const difficultyData = useMemo(() => {
    return questionBankConfig.enabledDifficulties.map((difficulty) => ({
      name: questionBankConfig.difficultyLabel(difficulty),
      questions: questions.filter((question) => question.difficulty === difficulty).length,
      tests: tests.filter((test) => test.difficulty === difficulty).length,
    }));
  }, [questionBankConfig, questions, tests]);

  const categoryData = useMemo(() => {
    const categoryCountMap = new Map<string, number>();
    for (const question of questions) {
      for (const catId of getQuestionCategoryIds(question)) {
        categoryCountMap.set(catId, (categoryCountMap.get(catId) ?? 0) + 1);
      }
    }
    return categories.map((category) => ({
      name: category.name,
      questions: categoryCountMap.get(category.id) ?? 0,
    }));
  }, [categories, questions]);

  const hasDifficultyData = difficultyData.some((item) => item.questions > 0 || item.tests > 0);
  const hasCategoryData = categoryData.some((item) => item.questions > 0);

  const exportColumns = useMemo<ExportColumn[]>(
    () => [
      { key: "type", header: t("common.type") },
      { key: "name", header: t("common.label") },
      { key: "questions", header: t("questionBank.questions") },
      { key: "tests", header: t("questionBank.report.generatedTests") },
    ],
    [t],
  );

  const summaryRows = useMemo<QuestionBankSummaryRow[]>(
    () => [
      ...difficultyData.map((item) => ({
        type: t("questionBank.columns.difficulty"),
        name: item.name,
        questions: item.questions,
        tests: item.tests,
      })),
      ...categoryData.map((item) => ({
        type: t("questionBank.category"),
        name: item.name,
        questions: item.questions,
        tests: "—",
      })),
    ],
    [categoryData, difficultyData, t],
  );

  const isError =
    questionsQuery.isError || testsQuery.isError || resultsQuery.isError || aggregatesQuery.isError;

  const refetchAll = () => {
    void questionsQuery.refetch();
    void testsQuery.refetch();
    void resultsQuery.refetch();
    void aggregatesQuery.refetch();
  };

  return {
    questions,
    tests,
    results,
    categories,
    difficultyData,
    categoryData,
    hasDifficultyData,
    hasCategoryData,
    exportColumns,
    summaryRows,
    isError,
    refetchAll,
  };
}
