import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormCollectionShell, FormListFieldCard } from "@/components/ui/FormPrimitives";
import { Input } from "@/components/ui/input";
import { joinQuestionCompoundAnswer, type AppTranslationKey } from "@mms/shared";
import { FORM_INPUT } from "@/components/ui/formStyles";

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

  const syncItems = (nextItems: string[]): void => {
    onOptionsChange(nextItems);
    onAnswerChange(joinQuestionCompoundAnswer(nextItems));
  };

  const moveItem = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reorderedItems = [...items];
    [reorderedItems[index], reorderedItems[target]] = [
      reorderedItems[target],
      reorderedItems[index],
    ];
    syncItems(reorderedItems);
  };

  return (
    <div className="sm:col-span-2">
      <FormCollectionShell
        title={t("questionBank.orderingItems")}
        addLabel={t("questionBank.addOrderingItem")}
        onAdd={() => syncItems([...items, ""])}
        listKey="qb-ordering"
      >
        {items.map((item, index) => (
          <FormListFieldCard
            key={index}
            id={`ordering-item-${index}`}
            index={index}
            label={t("questionBank.orderingItemN", { n: index + 1 })}
            removeLabel={t("questionBank.removeMatchingPair", { n: index + 1 })}
            canRemove={items.length > 2}
            onRemove={() => syncItems(items.filter((_, i) => i !== index))}
            headerExtras={
              <div className="flex flex-shrink-0 gap-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => moveItem(index, -1)}
                  className="rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                  aria-label={t("questionBank.moveOrderingUp", { n: index + 1 })}
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, 1)}
                  className="rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                  aria-label={t("questionBank.moveOrderingDown", { n: index + 1 })}
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            }
          >
            <Input
              id={`ordering-item-${index}`}
              name={`ordering-item-${index}`}
              className={FORM_INPUT}
              value={item}
              placeholder={t("questionBank.orderingItemN", { n: index + 1 })}
              aria-label={t("questionBank.orderingItemN", { n: index + 1 })}
              onChange={(event) => {
                const updatedItems = [...items];
                updatedItems[index] = event.target.value;
                syncItems(updatedItems);
              }}
            />
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
    </div>
  );
}
