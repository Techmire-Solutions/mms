import React from "react";
import { ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FieldErrorMessage,
  FormCollectionShell,
  FormListFieldCard,
} from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/app/RadioGroup";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";

import type { QuestionFormDraft, QuestionFormErrors } from "../lib/questionFormTypes";

interface QuestionFormMcqOptionsProps {
  questionDraft: QuestionFormDraft;
  errors: QuestionFormErrors;
  /** Update only the fields this editor owns; keeps the parent's draft subscription narrow. */
  onChange: (patch: { options?: string[]; answer?: string }) => void;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

/**
 * Dynamic MCQ option list: add/remove/reorder rows and pick the correct one.
 *
 * The correct answer is stored as the option text (the shared contract), so the radio is keyed by
 * **row index** — two empty or duplicate options can no longer collide, and moving a row keeps the
 * same row selected.
 */
export function QuestionFormMcqOptions({
  questionDraft,
  errors,
  onChange,
}: QuestionFormMcqOptionsProps): React.JSX.Element {
  const { t } = useTranslation();
  const options =
    questionDraft.options.length >= MIN_OPTIONS
      ? questionDraft.options
      : [...questionDraft.options, ...Array(MIN_OPTIONS - questionDraft.options.length).fill("")];
  const answer = questionDraft.answer ?? "";
  const correctIndex = options.findIndex((option) => option !== "" && option === answer);

  const sync = (nextOptions: string[], nextAnswer?: string): void => {
    onChange({
      options: nextOptions,
      ...(nextAnswer === undefined ? {} : { answer: nextAnswer }),
    });
  };

  const editOption = (index: number, value: string): void => {
    const next = options.map((option, optionIndex) => (optionIndex === index ? value : option));
    // Editing the correct row carries the selection with the new text.
    sync(next, index === correctIndex ? value : undefined);
  };

  const addOption = (): void => {
    if (options.length >= MAX_OPTIONS) return;
    sync([...options, ""]);
  };

  const removeOption = (index: number): void => {
    if (options.length <= MIN_OPTIONS) return;
    const next = options.filter((_option, optionIndex) => optionIndex !== index);
    sync(next, index === correctIndex ? "" : undefined);
  };

  const moveOption = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    [next[index], next[target]] = [next[target], next[index]];
    sync(next);
  };

  const selectCorrect = (index: number): void => {
    const value = options[index] ?? "";
    if (!value) return;
    sync(options, value);
  };

  return (
    <div className="sm:col-span-2">
      <FormCollectionShell
        title={t("questionBank.optionsLabel")}
        icon={ListChecks}
        addLabel={t("questionBank.addOption")}
        onAdd={addOption}
        addDisabled={options.length >= MAX_OPTIONS}
        listKey="qb-mcq-options"
      >
        <p className="text-xs text-muted-foreground">{t("questionBank.optionsHint")}</p>
        <RadioGroup
          name="qb-answer"
          value={correctIndex >= 0 ? String(correctIndex) : ""}
          onValueChange={(value) => selectCorrect(Number(value))}
          className="space-y-2 mt-1.5"
        >
          {options.map((optionValue, optionIndex) => (
            <FormListFieldCard
              key={optionIndex}
              id={`qb-choice-${optionIndex}`}
              index={optionIndex}
              label={t("questionBank.optionN", { n: optionIndex + 1 })}
              canRemove={options.length > MIN_OPTIONS}
              onRemove={() => removeOption(optionIndex)}
              removeLabel={t("questionBank.removeOption", { n: optionIndex + 1 })}
              headerExtras={
                <div className="flex flex-shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={optionIndex === 0}
                    onClick={() => moveOption(optionIndex, -1)}
                    className="rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                    aria-label={t("questionBank.moveOptionUp", { n: optionIndex + 1 })}
                  >
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={optionIndex === options.length - 1}
                    onClick={() => moveOption(optionIndex, 1)}
                    className="rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                    aria-label={t("questionBank.moveOptionDown", { n: optionIndex + 1 })}
                  >
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              }
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  id={`qb-choice-radio-${optionIndex}`}
                  value={String(optionIndex)}
                  disabled={!optionValue}
                  aria-label={t("questionBank.optionCorrect", { n: optionIndex + 1 })}
                />
                <Input
                  id={`qb-choice-input-${optionIndex}`}
                  name={`options.${optionIndex}`}
                  type="text"
                  className={FORM_INPUT}
                  value={optionValue}
                  onChange={(event) => editOption(optionIndex, event.target.value)}
                  placeholder={t("questionBank.optionN", { n: optionIndex + 1 })}
                  aria-label={t("questionBank.optionN", { n: optionIndex + 1 })}
                />
              </div>
            </FormListFieldCard>
          ))}
        </RadioGroup>
      </FormCollectionShell>
      <FieldErrorMessage message={errors.options ?? errors.answer} />
    </div>
  );
}
