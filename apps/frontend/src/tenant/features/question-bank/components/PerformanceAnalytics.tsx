import React, { lazy, Suspense } from "react";
import {
  getQuestionCategoryIds,
  QUESTION_ACCURACY_WEAK_THRESHOLD,
  calcPercentage as pct,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import {
  type CategoryPerformance,
  type PerformanceAnalyticsProps,
  type StudentStatItem,
  sumScores,
  testTotalMarks,
} from "../lib/performanceAnalyticsUtils";

const PerformanceAnalyticsPanels = lazy(() =>
  import("./PerformanceAnalyticsPanels").then((mod) => ({
    default: mod.PerformanceAnalyticsPanels,
  })),
);

export type { PerformanceAnalyticsProps } from "../lib/performanceAnalyticsUtils";

export function PerformanceAnalytics({
  tests,
  results,
  questions,
  categories,
}: PerformanceAnalyticsProps): React.ReactElement {
  const { t } = useTranslation();
  const qbConfig = useQuestionBankConfig(questions);

  const questionsById = new Map<string, (typeof questions)[number]>();
  for (const q of questions) {
    questionsById.set(q.id, q);
  }

  const testsById = new Map<string, (typeof tests)[number]>();
  const testTotalMarksById = new Map<string, number>();
  for (const test of tests) {
    testsById.set(test.id, test);
    testTotalMarksById.set(test.id, testTotalMarks(test, questionsById) || 100);
  }

  const studentStats = (() => {
    const statsByStudentId: Record<
      string,
      { name: string; class: string; scores: number[]; totalPts: number; maxPts: number }
    > = {};
    for (const result of results) {
      const test = testsById.get(result.testId);
      if (!test) continue;
      const totalMarks = testTotalMarksById.get(result.testId) ?? 100;
      const marksObtained = sumScores(result.scores);
      const percentageScore = pct(marksObtained, totalMarks);
      if (!statsByStudentId[result.studentId]) {
        statsByStudentId[result.studentId] = {
          name: result.studentName,
          class: t("questionBank.analytics.classLabel"),
          scores: [],
          totalPts: 0,
          maxPts: 0,
        };
      }
      statsByStudentId[result.studentId].scores.push(percentageScore);
      statsByStudentId[result.studentId].totalPts += marksObtained;
      statsByStudentId[result.studentId].maxPts += totalMarks;
    }
    return Object.values(statsByStudentId)
      .map((studentStat) => {
        const averageScore =
          studentStat.scores.length > 0
            ? Math.round(
                studentStat.scores.reduce((scoreTotal, score) => scoreTotal + score, 0) /
                  studentStat.scores.length,
              )
            : 0;
        return {
          ...studentStat,
          avg: averageScore,
          overall: pct(studentStat.totalPts, studentStat.maxPts),
        };
      })
      .sort((a, b) => b.avg - a.avg);
  })() as StudentStatItem[];

  const catPerformance = (() => {
    const countsByCatId = new Map<string, { correct: number; total: number }>();
    for (const category of categories) {
      countsByCatId.set(category.id, { correct: 0, total: 0 });
    }

    for (const result of results) {
      if (!result.answers) continue;
      for (const questionId of Object.keys(result.answers)) {
        const studentAns = result.answers[questionId];
        if (studentAns === undefined) continue;
        const question = questionsById.get(questionId);
        if (!question) continue;
        const isCorrect = studentAns === question.answer;
        const catIds = getQuestionCategoryIds(question);
        for (const catId of catIds) {
          const counts = countsByCatId.get(catId);
          if (counts) {
            counts.total++;
            if (isCorrect) counts.correct++;
          }
        }
      }
    }

    const performance: CategoryPerformance[] = [];
    for (const category of categories) {
      const counts = countsByCatId.get(category.id);
      if (counts && counts.total > 0) {
        const accuracy = Math.round((counts.correct / counts.total) * 100);
        performance.push({
          name: category.name,
          icon: category.icon,
          color: category.color,
          accuracy,
          correct: counts.correct,
          total: counts.total,
        });
      }
    }
    return performance;
  })();

  const weakAreas = catPerformance
    .filter((categoryResult) => categoryResult.accuracy < QUESTION_ACCURACY_WEAK_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy);

  const resultsByTestId = new Map<string, (typeof results)[number][]>();
  for (const result of results) {
    let list = resultsByTestId.get(result.testId);
    if (!list) {
      list = [];
      resultsByTestId.set(result.testId, list);
    }
    list.push(result);
  }

  const trendData = tests.map((test) => {
    const testResults = resultsByTestId.get(test.id) ?? [];
    const totalMarks = testTotalMarksById.get(test.id) ?? 100;
    const averageScore =
      testResults.length > 0
        ? Math.round(
            testResults.reduce(
              (scoreTotal, result) => scoreTotal + pct(sumScores(result.scores), totalMarks),
              0,
            ) / testResults.length,
          )
        : 0;
    return {
      name: test.name.length > 16 ? `${test.name.slice(0, 16)}…` : test.name,
      avg: averageScore,
    };
  });

  const diffData = (() => {
    const diffCounts = new Map<string, { correct: number; total: number }>();
    for (const diff of qbConfig.enabledDifficulties) {
      diffCounts.set(diff, { correct: 0, total: 0 });
    }

    for (const result of results) {
      if (!result.answers) continue;
      for (const questionId of Object.keys(result.answers)) {
        const studentAns = result.answers[questionId];
        if (studentAns === undefined) continue;
        const question = questionsById.get(questionId);
        if (!question || !question.difficulty) continue;
        const counts = diffCounts.get(question.difficulty);
        if (counts) {
          counts.total++;
          if (studentAns === question.answer) counts.correct++;
        }
      }
    }

    return qbConfig.enabledDifficulties.map((difficulty) => {
      const counts = diffCounts.get(difficulty);
      const total = counts?.total ?? 0;
      const correct = counts?.correct ?? 0;
      return {
        name: qbConfig.difficultyLabel(difficulty),
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    });
  })();

  const radarData = catPerformance.map((categoryResult) => ({
    subject: `${categoryResult.icon} ${categoryResult.name}`,
    accuracy: categoryResult.accuracy,
  }));

  return (
    <Suspense fallback={<Skeleton className="h-chart-md w-full rounded-xl" />}>
      <PerformanceAnalyticsPanels
        weakAreas={weakAreas}
        trendData={trendData}
        radarData={radarData}
        studentStats={studentStats}
        diffData={diffData}
        catPerformance={catPerformance}
      />
    </Suspense>
  );
}
