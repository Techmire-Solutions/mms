import type { QuestionCategory } from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
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
  /** Stable row id from the parent collection (never the array index). */
  rowId: string;
  index: number;
  categories: QuestionCategory[];
  availableCount: number;
  onUpdate: (patch: Partial<BlueprintRowValue>) => void;
}

/** One blueprint bucket: category × difficulty × type × count, plus its live availability. */
export function BlueprintRowCard({
  row,
  rowId: _rowId,
  index,
  categories,
  availableCount,
  onUpdate,
}: BlueprintRowCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const fieldPrefix = "qb-bp";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={`${fieldPrefix}-cat-${index}`} label={t("questionBank.category")}>
          <FormSelect
            id={`${fieldPrefix}-cat-${index}`}
            name={`bpCat${index}`}
            className={FORM_INPUT}
            value={row.categoryId}
            onChange={(value) => onUpdate({ categoryId: value })}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            placeholder={t("questionBank.category")}
          />
        </Field>
        <Field id={`${fieldPrefix}-diff-${index}`} label={t("questionBank.difficulty")}>
          <FormSelect
            id={`${fieldPrefix}-diff-${index}`}
            name={`bpDiff${index}`}
            className={FORM_INPUT}
            value={row.difficulty}
            onChange={(value) => onUpdate({ difficulty: value })}
            options={["easy", "medium", "hard"].map((value) => ({ value, label: value }))}
            placeholder={t("questionBank.difficulty")}
          />
        </Field>
        <Field id={`${fieldPrefix}-type-${index}`} label={t("questionBank.type")}>
          <FormSelect
            id={`${fieldPrefix}-type-${index}`}
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
        </Field>
        <Field
          id={`${fieldPrefix}-count-${index}`}
          label={t("questionBank.blueprintCount")}
          required
        >
          <Input
            id={`${fieldPrefix}-count-${index}`}
            name={`bpCount${index}`}
            type="number"
            inputMode="numeric"
            min={1}
            className={FORM_INPUT}
            value={row.count}
            onChange={(event) => onUpdate({ count: event.target.value })}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-2 text-3xs text-muted-foreground">
        <span>{t("questionBank.blueprintAvailable", { count: String(availableCount) })}</span>
      </div>
    </div>
  );
}
