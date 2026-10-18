import React, { useState } from "react";
import {
  calcPercentage as pct,
  type QuestionBankQuestion as Question,
  type QuestionBankResult,
  type QuestionBankTest,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { FORM_LABEL } from "@/components/ui/formStyles";
import { ReportDataGridContainer } from "@/tenant/components/moduleReports";
import {
  type StatsSummary,
  sumScores,
  testTotalMarks,
} from "@/tenant/features/question-bank/lib/autoGradingShared";
import { AutoGradingResultRow } from "@/tenant/features/question-bank/components/AutoGradingResultRow";
import { AutoGradingStats } from "@/tenant/features/question-bank/components/AutoGradingStats";

interface AutoGradingProps {
  tests: QuestionBankTest[];
  results: QuestionBankResult[];
  questions: Question[];
}

export function AutoGrading({ tests, results, questions }: AutoGradingProps): React.ReactElement {
  const { t } = useTranslation();
  const [selectedTest, setSelectedTest] = useState<string>(tests[0]?.id || "");
  const test = tests.find((item) => item.id === selectedTest);
  const testResults = results.filter((result) => result.testId === selectedTest);

  const questionsById = new Map<string, Question>();
  for (const q of questions) {
    questionsById.set(q.id, q);
  }

  const resultsCountByTestId = new Map<string, number>();
  for (const r of results) {
    resultsCountByTestId.set(r.testId, (resultsCountByTestId.get(r.testId) ?? 0) + 1);
  }

  const stats = (() => {
    if (!test || testResults.length === 0) return null;
    const totalMarks = testTotalMarks(test, questionsById) || 100;
    let totalPct = 0;
    let highest = -Infinity;
    let lowest = Infinity;
    for (const result of testResults) {
      const score = sumScores(result.scores);
      totalPct += pct(score, totalMarks);
      if (score > highest) highest = score;
      if (score < lowest) lowest = score;
    }
    const averageScore = Math.round(totalPct / testResults.length);
    return { avg: averageScore, highest, lowest };
  })() as StatsSummary | null;

  return (
    <section className="space-y-5" aria-labelledby="auto-grading-title">
      <div>
        <span id="auto-grading-title" className={FORM_LABEL}>
          {t("questionBank.grading.selectTest")}
        </span>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label={t("questionBank.grading.selectTestAria")}
        >
          {tests.map((item) => {
            const isSelected = selectedTest === item.id;
            const count = resultsCountByTestId.get(item.id) ?? 0;
            return (
              <Button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedTest(item.id)}
                className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition-all h-auto shadow-none ${isSelected ? "border-primary bg-primary/5 text-primary hover:bg-primary/10" : "border-border bg-card text-foreground hover:bg-muted"}`}
              >
                {item.name}
                <span className="ms-1.5 text-xs text-muted-foreground">
                  ({t("questionBank.grading.resultsCount", { count })})
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {test && (
        <>
          {stats && (
            <AutoGradingStats
              stats={stats}
              test={test}
              questions={questions}
              submittedCount={testResults.length}
            />
          )}

          <ReportDataGridContainer
            title={t("questionBank.grading.resultsTitle", { name: test.name })}
            columns={[
              { key: "studentName", header: t("examinations.report.colStudent") },
              { key: "testName", header: t("nav.questionBank") },
              { key: "score", header: t("examinations.report.colMarks") },
              { key: "percentage", header: t("examinations.report.colGrade") },
            ]}
            rows={(() => {
              const totalMarks = testTotalMarks(test, questionsById) || 100;
              return testResults.map((result) => {
                const marksObtained = sumScores(result.scores);
                return {
                  studentName: result.studentName,
                  testName: test.name,
                  score: `${marksObtained}/${totalMarks}`,
                  percentage: `${pct(marksObtained, totalMarks)}%`,
                };
              });
            })()}
            moduleId="question-bank"
            filename={`grading_${test.name.toLowerCase().replace(/\s+/g, "_")}`}
            empty={testResults.length === 0}
            emptyTitle={t("questionBank.grading.noResults")}
          >
            <div role="list">
              {testResults
                .sort((a, b) => sumScores(b.scores) - sumScores(a.scores))
                .map((result) => (
                  <AutoGradingResultRow
                    key={result.id}
                    result={result}
                    test={test}
                    questions={questionsById}
                  />
                ))}
            </div>
          </ReportDataGridContainer>
        </>
      )}
    </section>
  );
}
