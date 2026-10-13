import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import {
  ANSWER_LINE_COUNT_BY_TYPE,
  getPaperQuestionCount,
  PAPER_PRINT_STYLES,
  type PaperConfig,
  type PaperSection,
} from "@/tenant/features/question-bank/lib/paperBuilderUtils";

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
}: {
  question: Question;
  number: number;
}): React.ReactElement {
  const { t } = useTranslation();
  const optionLabels = ["A", "B", "C", "D", "E", "F"];
  const options = question.options.filter(Boolean);

  return (
    <div className="qpaper-question">
      <div className="qpaper-question-text">
        <span className="qpaper-question-number">{number}.</span>
        <span>{question.text}</span>
      </div>

      {question.type === "mcq" && options.length > 0 && (
        <div className="qpaper-options">
          {options.map((option, optionIndex) => (
            <div key={`${question.id}-${option}`} className="qpaper-option">
              <strong>{optionLabels[optionIndex] ?? `${optionIndex + 1}`}.</strong>
              <span>{option}</span>
            </div>
          ))}
        </div>
      )}

      {question.type === "true_false" && (
        <div className="qpaper-options">
          <div className="qpaper-option">
            <strong>A.</strong>
            <span>{t("questionBank.true")}</span>
          </div>
          <div className="qpaper-option">
            <strong>B.</strong>
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
                  {optionIndex + 1}. {option}
                </td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {question.type === "ordering" && options.length > 0 && (
        <div className="qpaper-options">
          {options.map((option, optionIndex) => (
            <div key={`${question.id}-${option}`} className="qpaper-option">
              <strong>{optionIndex + 1}.</strong>
              <span>{option}</span>
            </div>
          ))}
        </div>
      )}

      {renderAnswerLines(question)}
    </div>
  );
}

export function PrintablePaper({
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
  const instructions = config.instructions.trim() || t("questionBank.paperDefaultInstructions");
  let questionNumber = 0;

  return (
    <>
      <style>{PAPER_PRINT_STYLES}</style>
      <article className="qpaper" aria-label={t("questionBank.paperPreview")}>
        <header className="qpaper-header">
          <h1 className="qpaper-title">{title}</h1>
          <p className="qpaper-subtitle">{t("questionBank.paperSubtitle")}</p>
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
                  <PaperQuestion key={question.id} question={question} number={questionNumber} />
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
