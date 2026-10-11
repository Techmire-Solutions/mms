import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import {
  isQuestionAnswerCorrect,
  splitQuestionCompoundAnswer,
  type QuestionBankQuestion as Question,
  type QuestionBankResult,
  type QuestionBankTest,
  getInitials,
  calcPercentage as pct,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  sumScores,
  testTotalMarks,
  grade,
  GRADE_BADGE_CONFIG,
} from "@/tenant/features/question-bank/components/autoGradingShared";

interface ResultRowProps {
  result: QuestionBankResult;
  test: QuestionBankTest;
  questions: Question[] | Map<string, Question>;
}

export function AutoGradingResultRow({
  result,
  test,
  questions,
}: ResultRowProps): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const totalMarks = testTotalMarks(test, questions) || 100;
  const marksObtained = sumScores(result.scores);
  const percentageScore = pct(marksObtained, totalMarks);
  const gradeLabel = grade(percentageScore);

  const getQuestion = (qid: string): Question | undefined => {
    if (questions instanceof Map) return questions.get(qid);
    return questions.find((candidateQuestion) => candidateQuestion.id === qid);
  };

  return (
    <div className="border-b border-border/50 last:border-0">
      <Button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t("questionBank.grading.showDetailAria", { name: result.studentName })}
        variant="ghost"
        className="flex w-full items-center justify-between gap-3 h-auto px-4 py-3 text-start transition-colors hover:bg-muted/20 shadow-none rounded-none"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
            {getInitials(result.studentName)}
          </div>
          <p className="m-0 min-w-0 truncate text-sm font-semibold text-foreground">
            {result.studentName}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-4">
          <div className="text-end">
            <p className="text-sm font-bold text-foreground m-0">
              {marksObtained}/{totalMarks}
            </p>
            <p className="text-xs text-muted-foreground m-0">{percentageScore}%</p>
          </div>
          <StatusBadge
            status={gradeLabel.status}
            config={{
              [gradeLabel.status]: {
                ...GRADE_BADGE_CONFIG[gradeLabel.status],
                label: gradeLabel.label,
              },
            }}
          />
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          )}
        </div>
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-4 pb-3" role="list">
              {test.questionIds.map((qid, questionIndex) => {
                const question = getQuestion(qid);
                if (!question) return null;
                const studentAns = result.answers?.[qid];
                const correct =
                  question.type === "short"
                    ? studentAns === question.answer
                    : isQuestionAnswerCorrect(question, studentAns);
                const correctDisplay =
                  question.type === "matching" ||
                  question.type === "fill_blank" ||
                  question.type === "ordering"
                    ? splitQuestionCompoundAnswer(question.answer).join(", ")
                    : question.answer;
                return (
                  <div
                    key={qid}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs ${correct ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"}`}
                    role="listitem"
                  >
                    {correct ? (
                      <CheckCircle2
                        className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success"
                        aria-label={t("questionBank.grading.correctAnswer")}
                      />
                    ) : (
                      <XCircle
                        className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive"
                        aria-label={t("questionBank.grading.incorrectAnswer")}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-semibold m-0 ${correct ? "text-success" : "text-destructive"}`}
                      >
                        {t("questionBank.grading.questionLabel", {
                          n: questionIndex + 1,
                          text: question.text,
                        })}
                      </p>
                      {!correct && question.type !== "short" && (
                        <p className="mt-0.5 text-destructive m-0">
                          {t("questionBank.grading.studentAnswer", { answer: studentAns || "—" })} ·{" "}
                          {t("questionBank.grading.correctLabel", { answer: correctDisplay })}
                        </p>
                      )}
                      {question.type === "short" && (
                        <p className="mt-0.5 italic text-muted-foreground m-0">
                          {t("questionBank.grading.shortAnswerManual")}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold">
                      {correct ? `+${question.marks}` : "0"}/{question.marks}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
