import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import {
  getPaperQuestionCount,
  PAPER_PRINT_STYLES,
  type PaperConfig,
  type PaperSection,
} from "@/tenant/features/question-bank/lib/paperBuilderUtils";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"] as const;
const MIN_BUBBLES = 4;

/** Bubble sheet for a paper: one row per question, one circle per option. */
export function PrintableAnswerSheet({
  config,
  sections,
  questionsById,
}: {
  config: PaperConfig;
  sections: PaperSection[];
  questionsById: Map<string, Question>;
}): React.ReactElement {
  const { t } = useTranslation();
  const title = config.name || t("questionBank.previewDefaultName");
  const questions = sections.flatMap((section) =>
    section.questionIds
      .map((questionId) => questionsById.get(questionId))
      .filter((question): question is Question => Boolean(question)),
  );
  const bubbleCount = Math.min(
    OPTION_LABELS.length,
    Math.max(MIN_BUBBLES, ...questions.map((question) => question.options.length)),
  );

  return (
    <>
      <style>{PAPER_PRINT_STYLES}</style>
      <article className="qpaper-sheet" aria-label={t("questionBank.answerSheet")}>
        <header className="qpaper-header">
          <h1 className="qpaper-title">{title}</h1>
          <p className="qpaper-subtitle">
            {t("questionBank.paperSubtitle")} — {t("questionBank.answerSheet")}
          </p>
        </header>

        <section className="qpaper-sheet-head" aria-label={t("questionBank.paperDetails")}>
          <div className="qpaper-sheet-field">
            <span className="qpaper-meta-label">{t("questionBank.paperStudentName")}</span>&nbsp;
          </div>
          <div className="qpaper-sheet-field">
            <span className="qpaper-meta-label">{t("questionBank.paperRollNo")}</span>&nbsp;
          </div>
          <div className="qpaper-sheet-field">
            <span className="qpaper-meta-label">{t("questionBank.paperClass")}</span>
            {config.examClass || " "}
          </div>
          <div className="qpaper-sheet-field">
            <span className="qpaper-meta-label">{t("questionBank.paperDate")}</span>&nbsp;
          </div>
        </section>

        <p className="qpaper-instructions">{t("questionBank.answerSheetInstructions")}</p>
        <p className="qpaper-sheet-label">
          {t("questionBank.paperQuestionsCount")}: {getPaperQuestionCount(sections)}
        </p>

        <div className="qpaper-sheet-grid">
          {questions.map((question, index) => {
            const bubbles = Math.min(bubbleCount, Math.max(2, question.options.length || 2));
            return (
              <div key={question.id} className="qpaper-sheet-cell">
                <bdi className="qpaper-sheet-number">{index + 1}.</bdi>
                <span className="qpaper-sheet-options" aria-hidden="true">
                  {Array.from({ length: bubbles }, (_, bubbleIndex) => (
                    <span key={bubbleIndex} className="qpaper-bubble" />
                  ))}
                </span>
              </div>
            );
          })}
        </div>

        <footer className="qpaper-footer">
          <span>{t("questionBank.paperGeneratedFromBank")}</span>
          <span>{title}</span>
        </footer>
      </article>
    </>
  );
}
