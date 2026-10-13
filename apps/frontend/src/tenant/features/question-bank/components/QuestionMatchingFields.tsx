import React from "react";
import { Field } from "@/components/app/FormField";
import { FormCollectionShell, FormListFieldCard } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import {
  joinQuestionCompoundAnswer,
  splitQuestionCompoundAnswer,
  type AppTranslationKey,
} from "@mms/shared";
import { FORM_INPUT } from "@/components/ui/formStyles";

type TranslateFn = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

interface QuestionMatchingFieldsProps {
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

export function QuestionMatchingFields({
  options,
  answer,
  onOptionsChange,
  onAnswerChange,
  t,
}: QuestionMatchingFieldsProps): React.JSX.Element {
  const lefts = options.length > 0 ? options : ["", ""];
  const rights = ensureSize(splitQuestionCompoundAnswer(answer), lefts.length);
  const pairs = lefts.map((left, index) => ({ left, right: rights[index] ?? "" }));

  const syncPairs = (nextPairs: { left: string; right: string }[]): void => {
    onOptionsChange(nextPairs.map((pair) => pair.left));
    onAnswerChange(joinQuestionCompoundAnswer(nextPairs.map((pair) => pair.right)));
  };

  return (
    <div className="sm:col-span-2">
      <FormCollectionShell
        title={t("questionBank.matchingPairs")}
        addLabel={t("questionBank.addMatchingPair")}
        onAdd={() => syncPairs([...pairs, { left: "", right: "" }])}
        listKey="qb-matching"
      >
        {pairs.map((pair, index) => (
          <FormListFieldCard
            key={index}
            id={`matching-pair-${index}`}
            index={index}
            label={`${index + 1}`}
            removeLabel={t("questionBank.removeMatchingPair", { n: index + 1 })}
            canRemove={pairs.length > 2}
            onRemove={() => syncPairs(pairs.filter((_, i) => i !== index))}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field id={`matching-left-${index}`} label={t("questionBank.matchingLeft")}>
                <Input
                  id={`matching-left-${index}`}
                  name={`matching-left-${index}`}
                  className={FORM_INPUT}
                  value={pair.left}
                  onChange={(event) => {
                    const updatedPairs = pairs.map((pairCandidate, pairIndex) =>
                      pairIndex === index
                        ? { ...pairCandidate, left: event.target.value }
                        : pairCandidate,
                    );
                    syncPairs(updatedPairs);
                  }}
                />
              </Field>
              <Field id={`matching-right-${index}`} label={t("questionBank.matchingRight")}>
                <Input
                  id={`matching-right-${index}`}
                  name={`matching-right-${index}`}
                  className={FORM_INPUT}
                  value={pair.right}
                  onChange={(event) => {
                    const updatedPairs = pairs.map((pairCandidate, pairIndex) =>
                      pairIndex === index
                        ? { ...pairCandidate, right: event.target.value }
                        : pairCandidate,
                    );
                    syncPairs(updatedPairs);
                  }}
                />
              </Field>
            </div>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
    </div>
  );
}
