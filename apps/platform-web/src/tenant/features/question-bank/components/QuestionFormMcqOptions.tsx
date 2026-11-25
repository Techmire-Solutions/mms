import React, { useRef } from "react";
import { ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { Button } from "@mms/ui";
import {
  FieldErrorMessage,
  FormCollectionShell,
  FormListFieldCard,
} from "@mms/fe-core/components/FormPrimitives";
import { Input } from "@mms/ui";
import { RadioGroup, RadioGroupItem } from "@mms/ui/app/RadioGroup";
import { FORM_INPUT } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { useStableRowList } from "@mms/fe-core/forms/useStableRowList";

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

  // Edit/remove must emit one combined patch (options + answer), so the answer
  // travels through the row operation instead of as a second parent update.
  const pendingAnswer = useRef<string | undefined>(undefined);
  const { rows, append, removeAt, move, updateAt } = useStableRowList<string>({
    values: options,
    onChange: (nextOptions) => {
      const answerPatch = pendingAnswer.current;
      pendingAnswer.current = undefined;
      onChange({
        options: nextOptions,
        ...(answerPatch === undefined ? {} : { answer: answerPatch }),
      });
    },
    createValue: () => "",
    serialize: (nextOptions) => nextOptions.join("\u0000"),
  });

  const editOption = (index: number, value: string): void => {
    // Editing the correct row carries the selection with the new text.
    if (index === correctIndex) pendingAnswer.current = value;
    updateAt(index, () => value);
  };

  const addOption = (): void => {
    if (rows.length >= MAX_OPTIONS) return;
    append();
  };

  const removeOption = (index: number): void => {
    if (rows.length <= MIN_OPTIONS) return;
    if (index === correctIndex) pendingAnswer.current = "";
    removeAt(index);
  };

  const moveOption = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    move(index, target);
  };

  const selectCorrect = (index: number): void => {
    const value = rows[index]?.value ?? "";
    if (!value) return;
    onChange({ options: rows.map((row) => row.value), answer: value });
  };

  return (
    <div className="sm:col-span-2">
      <FormCollectionShell
        title={t("questionBank.optionsLabel")}
        icon={ListChecks}
        addLabel={t("questionBank.addOption")}
        onAdd={addOption}
        addDisabled={rows.length >= MAX_OPTIONS}
        listKey="qb-mcq-options"
      >
        <p className="text-xs text-muted-foreground">{t("questionBank.optionsHint")}</p>
        <RadioGroup
          name="qb-answer"
          value={correctIndex >= 0 ? String(correctIndex) : ""}
          onValueChange={(value) => selectCorrect(Number(value))}
          className="space-y-2 mt-1.5"
        >
          {rows.map((row, optionIndex) => {
            const optionValue = row.value;
            return (
              <FormListFieldCard
                key={row.id}
                id={`qb-choice-${row.id}`}
                index={optionIndex}
                label={t("questionBank.optionN", { n: optionIndex + 1 })}
                canRemove={rows.length > MIN_OPTIONS}
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
                      disabled={optionIndex === rows.length - 1}
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
                    id={`qb-choice-radio-${row.id}`}
                    value={String(optionIndex)}
                    disabled={!optionValue}
                    aria-label={t("questionBank.optionCorrect", { n: optionIndex + 1 })}
                  />
                  <Input
                    id={`qb-choice-input-${row.id}`}
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
            );
          })}
        </RadioGroup>
      </FormCollectionShell>
      <FieldErrorMessage message={errors.options ?? errors.answer} />
    </div>
  );
}
