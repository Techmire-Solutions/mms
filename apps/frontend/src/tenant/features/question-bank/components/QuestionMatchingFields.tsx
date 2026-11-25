import React from "react";
import { Field } from "@/components/app/FormField";
import { FormCollectionShell, FormListFieldCard } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import {
  joinQuestionCompoundAnswer,
  splitQuestionCompoundAnswer,
  type AppTranslationKey,
} from "@mms/contracts";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useStableRowList } from "@/lib/forms/useStableRowList";

type TranslateFn = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

interface QuestionMatchingFieldsProps {
  options: string[];
  answer: string;
  onOptionsChange: (options: string[]) => void;
  onAnswerChange: (answer: string) => void;
  t: TranslateFn;
}

interface MatchingPair {
  left: string;
  right: string;
}

function ensureSize(items: string[], size: number): string[] {
  const sizedItems = [...items];
  while (sizedItems.length < size) sizedItems.push("");
  return sizedItems.slice(0, Math.max(size, 0));
}

function serializePairs(pairs: readonly MatchingPair[]): string {
  return pairs.map((pair) => `${pair.left}\u0000${pair.right}`).join("\u0001");
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
  const pairs: MatchingPair[] = lefts.map((left, index) => ({
    left,
    right: rights[index] ?? "",
  }));

  const { rows, append, removeAt, updateAt } = useStableRowList<MatchingPair>({
    values: pairs,
    onChange: (nextPairs) => {
      onOptionsChange(nextPairs.map((pair) => pair.left));
      onAnswerChange(joinQuestionCompoundAnswer(nextPairs.map((pair) => pair.right)));
    },
    createValue: () => ({ left: "", right: "" }),
    serialize: serializePairs,
  });

  return (
    <div className="sm:col-span-2">
      <FormCollectionShell
        title={t("questionBank.matchingPairs")}
        addLabel={t("questionBank.addMatchingPair")}
        onAdd={append}
        listKey="qb-matching"
      >
        {rows.map((row, index) => {
          const pair = row.value;
          return (
            <FormListFieldCard
              key={row.id}
              id={`matching-pair-${row.id}`}
              index={index}
              label={`${index + 1}`}
              removeLabel={t("questionBank.removeMatchingPair", { n: index + 1 })}
              canRemove={rows.length > 2}
              onRemove={() => removeAt(index)}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field id={`matching-left-${row.id}`} label={t("questionBank.matchingLeft")}>
                  <Input
                    id={`matching-left-${row.id}`}
                    name={`matching-left-${row.id}`}
                    className={FORM_INPUT}
                    value={pair.left}
                    onChange={(event) =>
                      updateAt(index, (current) => ({ ...current, left: event.target.value }))
                    }
                  />
                </Field>
                <Field id={`matching-right-${row.id}`} label={t("questionBank.matchingRight")}>
                  <Input
                    id={`matching-right-${row.id}`}
                    name={`matching-right-${row.id}`}
                    className={FORM_INPUT}
                    value={pair.right}
                    onChange={(event) =>
                      updateAt(index, (current) => ({ ...current, right: event.target.value }))
                    }
                  />
                </Field>
              </div>
            </FormListFieldCard>
          );
        })}
      </FormCollectionShell>
    </div>
  );
}
