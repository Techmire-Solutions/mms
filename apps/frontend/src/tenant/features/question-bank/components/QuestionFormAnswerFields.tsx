import { type AppTranslationKey, type QuestionType } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldErrorMessage, LABEL, RequiredMark } from "@/components/app/FormPrimitives";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
import { QuestionFormMcqOptions } from "@/tenant/features/question-bank/components/QuestionFormMcqOptions";
import { QuestionTypeAnswerFields } from "@/tenant/features/question-bank/components/QuestionTypeAnswerFields";

import type {
  QuestionFormDraft,
  QuestionFormErrors,
  UpdateQuestionDraft,
} from "../lib/questionFormTypes";

interface QuestionFormAnswerFieldsProps {
  questionDraft: QuestionFormDraft;
  errors: QuestionFormErrors;
  updateDraft: UpdateQuestionDraft;
}

const COMPOUND_ANSWER_TYPES = new Set<QuestionType>([
  "fill_blank",
  "matching",
  "numeric",
  "ordering",
]);

export function QuestionFormAnswerFields({
  questionDraft,
  errors,
  updateDraft,
}: QuestionFormAnswerFieldsProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const trueLabel = t("questionBank.true");
  const falseLabel = t("questionBank.false");

  if (questionDraft.type === "mcq") {
    return (
      <QuestionFormMcqOptions
        questionDraft={questionDraft}
        errors={errors}
        onChange={(patch) => updateDraft(patch)}
      />
    );
  }

  if (questionDraft.type === "true_false") {
    return (
      <div className="sm:col-span-2">
        <span className={LABEL}>
          {t("questionBank.correctAnswer")}
          <RequiredMark />
        </span>
        <div className="flex gap-3 mt-1.5">
          {[trueLabel, falseLabel].map((answerValue) => (
            <Button
              key={answerValue}
              type="button"
              variant="outline"
              onClick={() => updateDraft({ answer: answerValue })}
              className={`flex-1 min-h-11 rounded-lg border py-2 text-sm font-medium ${questionDraft.answer === answerValue ? "border-primary bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {answerValue}
            </Button>
          ))}
        </div>
        <FieldErrorMessage message={errors.answer} />
      </div>
    );
  }

  if (questionDraft.type === "short") {
    return (
      <div className="sm:col-span-2">
        <Field id="qb-answer" label={t("questionBank.modelAnswer")}>
          <Textarea
            id="qb-answer"
            name="answer"
            value={questionDraft.answer || ""}
            onChange={(e) => updateDraft({ answer: e.target.value })}
            placeholder={t("questionBank.modelAnswerPlaceholder")}
          />
        </Field>
      </div>
    );
  }

  if (COMPOUND_ANSWER_TYPES.has(questionDraft.type)) {
    return (
      <QuestionTypeAnswerFields
        questionType={questionDraft.type}
        text={String(questionDraft.text ?? "")}
        options={questionDraft.options}
        answer={String(questionDraft.answer ?? "")}
        onOptionsChange={(next) => updateDraft({ options: next })}
        onAnswerChange={(next) => updateDraft({ answer: next })}
        t={(key) => t(key as AppTranslationKey)}
      />
    );
  }

  return null;
}
