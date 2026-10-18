import type { JSX } from "react";
import {
  formatQuestionSourcesCitation,
  splitQuestionCompoundAnswer,
  type QuestionBankQuestion as Question,
} from "@mms/shared";
import { FORM_LABEL } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;
type QuestionBankField = QuestionBankConfig["orderedFields"][number];

export interface QuestionCardAnswerPreviewProps {
  question: Question;
  config: QuestionBankConfig;
  showSourceCitation: boolean;
  visibleCustomFields: QuestionBankField[];
  t: TranslationFunction;
}

export function QuestionCardAnswerPreview({
  question,
  config,
  showSourceCitation,
  visibleCustomFields,
  t,
}: QuestionCardAnswerPreviewProps): JSX.Element {
  return (
    <div className="space-y-2">
      {config.isFieldEnabled("options") &&
        question.type === "mcq" &&
        question.options &&
        question.options.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {question.options.filter(Boolean).map((option, optionIndex) => (
              <span
                key={optionIndex}
                className={`rounded-md border px-2 py-0.5 text-xs ${option === question.answer ? "border-primary/30 bg-primary/5 font-semibold text-primary" : "border-border bg-muted text-muted-foreground"}`}
              >
                {option === question.answer ? `✓ ` : ""}
                {option}
              </span>
            ))}
          </div>
        )}
      {config.isFieldEnabled("answer") && question.type === "true_false" && (
        <p className="text-xs font-semibold text-primary">✓ {question.answer}</p>
      )}
      {question.type === "fill_blank" && question.answer && (
        <p className="text-xs text-muted-foreground">
          {t("questionBank.previewFillBlank", {
            answers: splitQuestionCompoundAnswer(question.answer).join(", "),
          })}
        </p>
      )}
      {question.type === "matching" && question.options.length > 0 && (
        <div className="space-y-1">
          <p className={cn(FORM_LABEL, "mb-0")}>{t("questionBank.previewMatching")}</p>
          {question.options.map((left, index) => (
            <p key={index} className="text-xs text-foreground">
              {left} → {splitQuestionCompoundAnswer(question.answer)[index] ?? "—"}
            </p>
          ))}
        </div>
      )}
      {question.type === "numeric" && question.answer && (
        <p className="text-xs text-muted-foreground">
          {t("questionBank.previewNumeric", { answer: question.answer })}
          {question.options[0] ? ` (±${question.options[0]})` : ""}
        </p>
      )}
      {question.type === "ordering" && question.options.length > 0 && (
        <div>
          <p className={cn(FORM_LABEL, "mb-0")}>{t("questionBank.previewOrdering")}</p>
          <ol className="mt-1 list-decimal space-y-0.5 ps-4 text-xs text-foreground">
            {question.options.filter(Boolean).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      )}
      {showSourceCitation &&
        (() => {
          const citation = formatQuestionSourcesCitation(question, t, config.sourceBooks);
          if (!citation) return null;
          return (
            <p className="text-xs leading-snug text-muted-foreground">
              <span className="font-semibold text-foreground/80">
                {t("questionBank.sourceReference")}:
              </span>{" "}
              {citation}
            </p>
          );
        })()}
      {visibleCustomFields.map((field) => {
        const fieldValue = Reflect.get(question, field.id);
        if (fieldValue === undefined || fieldValue === "") return null;
        return (
          <p key={field.id} className="text-xs text-muted-foreground">
            <span className="font-semibold">{config.fieldLabel(field.id, field.label)}:</span>{" "}
            {Array.isArray(fieldValue) ? fieldValue.join(", ") : String(fieldValue)}
          </p>
        );
      })}
    </div>
  );
}
