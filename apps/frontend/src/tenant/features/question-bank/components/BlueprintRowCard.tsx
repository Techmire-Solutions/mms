import type { QuestionCategory } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";

export interface BlueprintRowValue {
  categoryId: string;
  difficulty: string;
  type: string;
  count: string;
}

interface BlueprintRowCardProps {
  row: BlueprintRowValue;
  index: number;
  categories: QuestionCategory[];
  availableCount: number;
  onUpdate: (patch: Partial<BlueprintRowValue>) => void;
  onRemove?: () => void;
}

/** One blueprint bucket: category × difficulty × type × count, plus its live availability. */
export function BlueprintRowCard({
  row,
  index,
  categories,
  availableCount,
  onUpdate,
  onRemove,
}: BlueprintRowCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="grid gap-2 sm:grid-cols-4">
        <FormSelect
          id={`qb-bp-cat-${index}`}
          name={`bpCat${index}`}
          className={FORM_INPUT}
          value={row.categoryId}
          onChange={(value) => onUpdate({ categoryId: value })}
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          placeholder={t("questionBank.category")}
        />
        <FormSelect
          id={`qb-bp-diff-${index}`}
          name={`bpDiff${index}`}
          className={FORM_INPUT}
          value={row.difficulty}
          onChange={(value) => onUpdate({ difficulty: value })}
          options={["easy", "medium", "hard"].map((value) => ({ value, label: value }))}
          placeholder={t("questionBank.difficulty")}
        />
        <FormSelect
          id={`qb-bp-type-${index}`}
          name={`bpType${index}`}
          className={FORM_INPUT}
          value={row.type}
          onChange={(value) => onUpdate({ type: value })}
          options={[
            "mcq",
            "short",
            "true_false",
            "fill_blank",
            "matching",
            "numeric",
            "ordering",
          ].map((value) => ({ value, label: value }))}
          placeholder={t("questionBank.type")}
        />
        <input
          id={`qb-bp-count-${index}`}
          name={`bpCount${index}`}
          type="number"
          min={1}
          className={FORM_INPUT}
          aria-label={t("questionBank.blueprintCount")}
          value={row.count}
          onChange={(event) => onUpdate({ count: event.target.value })}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-3xs text-muted-foreground">
        <span>{t("questionBank.blueprintAvailable", { count: String(availableCount) })}</span>
        {onRemove && (
          <Button type="button" variant="outline" size="sm" onClick={onRemove}>
            {t("common.delete")}
          </Button>
        )}
      </div>
    </div>
  );
}
