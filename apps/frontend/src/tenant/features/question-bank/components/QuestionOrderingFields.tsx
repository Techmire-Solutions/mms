import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormCollectionShell, FormListFieldCard } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { joinQuestionCompoundAnswer, type AppTranslationKey } from "@mms/shared";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useStableRowList } from "@/lib/forms/useStableRowList";

type TranslateFn = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

interface QuestionOrderingFieldsProps {
  options: string[];
  onOptionsChange: (options: string[]) => void;
  onAnswerChange: (answer: string) => void;
  t: TranslateFn;
}

export function QuestionOrderingFields({
  options,
  onOptionsChange,
  onAnswerChange,
  t,
}: QuestionOrderingFieldsProps): React.JSX.Element {
  const items = options.length > 0 ? options : ["", ""];

  const { rows, append, removeAt, move, updateAt } = useStableRowList<string>({
    values: items,
    onChange: (nextItems) => {
      onOptionsChange(nextItems);
      onAnswerChange(joinQuestionCompoundAnswer(nextItems));
    },
    createValue: () => "",
    serialize: (nextItems) => nextItems.join("\u0000"),
  });

  return (
    <div className="sm:col-span-2">
      <FormCollectionShell
        title={t("questionBank.orderingItems")}
        addLabel={t("questionBank.addOrderingItem")}
        onAdd={append}
        listKey="qb-ordering"
      >
        {rows.map((row, index) => (
          <FormListFieldCard
            key={row.id}
            id={`ordering-item-${row.id}`}
            index={index}
            label={t("questionBank.orderingItemN", { n: index + 1 })}
            removeLabel={t("questionBank.removeMatchingPair", { n: index + 1 })}
            canRemove={rows.length > 2}
            onRemove={() => removeAt(index)}
            headerExtras={
              <div className="flex flex-shrink-0 gap-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                  className="rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                  aria-label={t("questionBank.moveOrderingUp", { n: index + 1 })}
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, index + 1)}
                  className="rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                  aria-label={t("questionBank.moveOrderingDown", { n: index + 1 })}
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            }
          >
            <Input
              id={`ordering-item-${row.id}`}
              name={`ordering-item-${row.id}`}
              className={FORM_INPUT}
              value={row.value}
              placeholder={t("questionBank.orderingItemN", { n: index + 1 })}
              aria-label={t("questionBank.orderingItemN", { n: index + 1 })}
              onChange={(event) => updateAt(index, () => event.target.value)}
            />
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
    </div>
  );
}
