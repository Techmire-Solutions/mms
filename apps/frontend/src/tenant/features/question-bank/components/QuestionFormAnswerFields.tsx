import { HelpCircle } from "lucide-react";
import { type AppTranslationKey, type QuestionType } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldErrorMessage, LABEL, RequiredMark } from "@/components/ui/FormPrimitives";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Textarea } from "@/components/ui/textarea";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { QuestionTypeAnswerFields } from "@/tenant/features/question-bank/components/QuestionTypeAnswerFields";

import type {
  QuestionFormDraft,
  QuestionFormErrors,
  UpdateQuestionDraft,
} from "./questionFormTypes";

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
      <div className="sm:col-span-2">
        <span className={LABEL}>{t("questionBank.optionsLabel")}</span>
        <RadioGroup
          name="qb-answer"
          value={questionDraft.answer}
          onValueChange={(val) => updateDraft({ answer: val })}
          className="space-y-2 mt-1.5"
        >
          {questionDraft.options.slice(0, 4).map((optionValue, optionIndex) => (
            <div key={optionIndex} className="relative flex items-center group/input w-full gap-2">
              <RadioGroupItem
                id={`qb-choice-radio-${optionIndex}`}
                value={optionValue}
                disabled={!optionValue}
                aria-label={t("questionBank.markChoiceCorrect", { n: optionIndex + 1 })}
              />
              <div className="relative flex items-center w-full">
                <HelpCircle className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
                <Input
                  id={`qb-choice-input-${optionIndex}`}
                  name={`options.${optionIndex}`}
                  type="text"
                  className={`${FORM_INPUT} ps-10`}
                  value={optionValue}
                  onChange={(e) => {
                    const nextOptions = [...questionDraft.options];
                    nextOptions[optionIndex] = e.target.value;
                    updateDraft({ options: nextOptions });
                  }}
                  placeholder={t("questionBank.optionN", { n: optionIndex + 1 })}
                  aria-label={t("questionBank.optionN", { n: optionIndex + 1 })}
                />
              </div>
            </div>
          ))}
        </RadioGroup>
        <FieldErrorMessage message={errors.answer} />
      </div>
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
