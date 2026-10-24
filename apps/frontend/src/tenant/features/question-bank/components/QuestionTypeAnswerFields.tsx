import React from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/FormPrimitives";
import {
  countFillBlankMarkers,
  joinQuestionCompoundAnswer,
  splitQuestionCompoundAnswer,
  type AppTranslationKey,
  type QuestionBankQuestion as Question,
} from "@mms/shared";
import { FORM_INPUT, FORM_LABEL } from "@/components/ui/formStyles";
import { QuestionMatchingFields } from "./QuestionMatchingFields";
import { QuestionOrderingFields } from "./QuestionOrderingFields";

type TranslateFn = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

interface QuestionTypeAnswerFieldsProps {
  questionType: Question["type"];
  text: string;
  options: string[];
  answer: string;
  onOptionsChange: (options: string[]) => void;
  onAnswerChange: (answer: string) => void;
  t: TranslateFn;
}

function ensureSize(items: string[], size: number): string[] {
  const sizedItems = [...items];
  while (sizedItems.length < size) sizedItems.push("");
  return sizedItems.slice(0, Math.max(size, 0));
}

export function QuestionTypeAnswerFields({
  questionType,
  text,
  options,
  answer,
  onOptionsChange,
  onAnswerChange,
  t,
}: QuestionTypeAnswerFieldsProps): React.JSX.Element | null {
  if (questionType === "fill_blank") {
    const blankCount = Math.max(countFillBlankMarkers(text), 1);
    const blanks = ensureSize(splitQuestionCompoundAnswer(answer), blankCount);

    return (
      <div className="space-y-3 sm:col-span-2">
        <p className="text-xs text-muted-foreground">{t("questionBank.fillBlankHint")}</p>
        <p className={FORM_LABEL}>{t("questionBank.blankAnswers")}</p>
        <div className="space-y-2">
          {blanks.map((blank, index) => (
            <Field
              key={index}
              id={`qb-blank-${index}`}
              label={t("questionBank.blankAnswerN", { n: index + 1 })}
            >
              <Input
                id={`qb-blank-${index}`}
                name={`blank-${index}`}
                className={FORM_INPUT}
                value={blank}
                onChange={(event) => {
                  const updatedBlanks = [...blanks];
                  updatedBlanks[index] = event.target.value;
                  onAnswerChange(joinQuestionCompoundAnswer(updatedBlanks));
                }}
              />
            </Field>
          ))}
        </div>
      </div>
    );
  }

  if (questionType === "matching") {
    return (
      <QuestionMatchingFields
        options={options}
        answer={answer}
        onOptionsChange={onOptionsChange}
        onAnswerChange={onAnswerChange}
        t={t}
      />
    );
  }

  if (questionType === "ordering") {
    return (
      <QuestionOrderingFields
        options={options}
        onOptionsChange={onOptionsChange}
        onAnswerChange={onAnswerChange}
        t={t}
      />
    );
  }

  if (questionType === "numeric") {
    const tolerance = options[0] ?? "";

    return (
      <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
        <Field id="qb-numeric-answer" label={t("questionBank.numericAnswer")} required>
          <Input
            id="qb-numeric-answer"
            name="numericAnswer"
            type="text"
            inputMode="decimal"
            className={FORM_INPUT}
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
          />
        </Field>
        <Field id="qb-numeric-tolerance" label={t("questionBank.numericTolerance")}>
          <Input
            id="qb-numeric-tolerance"
            name="numericTolerance"
            type="text"
            inputMode="decimal"
            className={FORM_INPUT}
            value={tolerance}
            onChange={(e) => onOptionsChange(e.target.value ? [e.target.value] : [])}
          />
        </Field>
      </div>
    );
  }

  return null;
}
