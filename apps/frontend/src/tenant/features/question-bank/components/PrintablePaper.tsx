import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import {
  ANSWER_LINE_COUNT_BY_TYPE,
  getPaperQuestionCount,
  PAPER_PRINT_STYLES,
  type PaperConfig,
  type PaperPrintMode,
  type PaperSection,
} from "@/tenant/features/question-bank/lib/paperBuilderUtils";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"] as const;

/** Latin exam labels, isolated so RTL punctuation cannot flip `A.` into `.A`. */
function optionLabel(index: number): string {
  return `${OPTION_LABELS[index] ?? `${index + 1}`}.`;
}

function renderAnswerLines(question: Question): React.ReactElement | null {
  const lineCount = ANSWER_LINE_COUNT_BY_TYPE[question.type] ?? 2;
  if (lineCount === 0) return null;
  return (
    <div className="qpaper-lines" aria-hidden="true">
      {Array.from({ length: lineCount }, (_, lineIndex) => (
        <div key={lineIndex} className="qpaper-line" />
      ))}
    </div>
  );
}

function PaperQuestion({
  question,
  number,
  mode,
}: {
  question: Question;
  number: number;
  mode: PaperPrintMode;
}): React.ReactElement {
  const { t } = useTranslation();
  const options = question.options.filter(Boolean);
  const isAnswerKey = mode === "answerKey";

  return (
    <div className="qpaper-question">
      <div className="qpaper-question-text">
        <bdi className="qpaper-question-number">{number}.</bdi>
        <span>{question.text}</span>
      </div>

      {question.type === "mcq" && options.length > 0 && (
        <div className="qpaper-options">
          {options.map((option, optionIndex) => (
            <div
              key={`${question.id}-${option}`}
              className={`qpaper-option${isAnswerKey && option === question.answer ? " qpaper-option-correct" : ""}`}
            >
              <strong>
                <bdi>{optionLabel(optionIndex)}</bdi>
              </strong>
              <span>{option}</span>
            </div>
          ))}
        </div>
      )}

      {question.type === "true_false" && (
        <div className="qpaper-options">
          <div
            className={`qpaper-option${isAnswerKey && question.answer.trim().toLowerCase() === "true" ? " qpaper-option-correct" : ""}`}
          >
            <strong>
              <bdi>A.</bdi>
            </strong>
            <span>{t("questionBank.true")}</span>
          </div>
          <div
            className={`qpaper-option${isAnswerKey && question.answer.trim().toLowerCase() === "false" ? " qpaper-option-correct" : ""}`}
          >
            <strong>
              <bdi>B.</bdi>
            </strong>
            <span>{t("questionBank.false")}</span>
          </div>
        </div>
      )}

      {/* intentional: print layout table — uses qpaper-matching CSS print styles.
          Do NOT migrate to WorkBatchTable or Table primitive; it must remain a raw
          <table> so the qpaper-matching ruleset (margin, border, column sizing) applies. */}
      {question.type === "matching" && options.length > 0 && (
        <table className="qpaper-matching">
          <tbody>
            {options.map((option, optionIndex) => (
              <tr key={`${question.id}-${option}`}>
                <td>
                  <bdi>{optionIndex + 1}.</bdi> {option}
                </td>
                <td aria-hidden="true">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {question.type === "ordering" && options.length > 0 && (
        <div className="qpaper-options">
          {options.map((option, optionIndex) => (
            <div key={`${question.id}-${option}`} className="qpaper-option">
              <strong>
                <bdi>{optionIndex + 1}.</bdi>
              </strong>
              <span>{option}</span>
            </div>
          ))}
        </div>
      )}

      {isAnswerKey ? (
        <div className="qpaper-answer">
          <strong>{t("questionBank.answerKey")}:</strong> <span>{question.answer}</span>
        </div>
      ) : (
        renderAnswerLines(question)
      )}
    </div>
  );
}

export function PrintablePaper({
  config,
  sections,
  questionsById,
  mode = "paper",
}: {
  config: PaperConfig;
  sections: PaperSection[];
  questionsById: Map<string, Question>;
  mode?: Exclude<PaperPrintMode, "answerSheet">;
}): React.ReactElement {
  const { t } = useTranslation();
  const title = config.name || t("questionBank.previewDefaultName");
  const instructions = config.instructions.trim() || t("questionBank.paperDefaultInstructions");
  let questionNumber = 0;

  return (
    <>
      <style>{PAPER_PRINT_STYLES}</style>
      <article className="qpaper" aria-label={t("questionBank.paperPreview")}>
        <header className="qpaper-header">
          <h1 className="qpaper-title">{title}</h1>
          <p className="qpaper-subtitle">
            {mode === "answerKey"
              ? `${t("questionBank.paperSubtitle")} — ${t("questionBank.answerKey")}`
              : t("questionBank.paperSubtitle")}
          </p>
        </header>

        <section className="qpaper-meta" aria-label={t("questionBank.paperDetails")}>
          <div className="qpaper-meta-cell">
            <span className="qpaper-meta-label">{t("questionBank.paperStudentName")}</span>&nbsp;
          </div>
          <div className="qpaper-meta-cell">
            <span className="qpaper-meta-label">{t("questionBank.paperRollNo")}</span>&nbsp;
          </div>
          <div className="qpaper-meta-cell">
            <span className="qpaper-meta-label">{t("questionBank.paperClass")}</span>
            {config.examClass || " "}
          </div>
          <div className="qpaper-meta-cell">
            <span className="qpaper-meta-label">{t("questionBank.paperDate")}</span>&nbsp;
          </div>
          <div className="qpaper-meta-cell">
            <span className="qpaper-meta-label">{t("questionBank.paperDuration")}</span>
            {t("questionBank.previewDuration", { minutes: config.duration })}
          </div>
          <div className="qpaper-meta-cell">
            <span className="qpaper-meta-label">{t("questionBank.paperTotalMarks")}</span>
            {config.totalMarks}
          </div>
          <div className="qpaper-meta-cell">
            <span className="qpaper-meta-label">{t("questionBank.paperQuestionsCount")}</span>
            {getPaperQuestionCount(sections)}
          </div>
          <div className="qpaper-meta-cell">
            <span className="qpaper-meta-label">{t("questionBank.paperSignature")}</span>&nbsp;
          </div>
        </section>

        <section className="qpaper-instructions">
          <strong>{t("questionBank.paperInstructions")}:</strong> {instructions}
        </section>

        {sections.map((section) => {
          const sectionQuestions = section.questionIds
            .map((questionId) => questionsById.get(questionId))
            .filter((question): question is Question => Boolean(question));
          if (sectionQuestions.length === 0) return null;

          return (
            <section key={section.id} className="qpaper-section">
              <h2 className="qpaper-section-title">{section.title}</h2>
              {section.instructions.trim() && (
                <p className="qpaper-section-note">{section.instructions}</p>
              )}
              {sectionQuestions.map((question) => {
                questionNumber += 1;
                return (
                  <PaperQuestion
                    key={question.id}
                    question={question}
                    number={questionNumber}
                    mode={mode}
                  />
                );
              })}
            </section>
          );
        })}

        <footer className="qpaper-footer">
          <span>{t("questionBank.paperGeneratedFromBank")}</span>
          <span>{title}</span>
        </footer>
      </article>
    </>
  );
}
