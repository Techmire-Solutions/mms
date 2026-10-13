import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { createQuestionCategory, type QuestionCategory } from "@mms/shared";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/app/SectionLabel";
import { CategoryColorChip } from "@/tenant/features/question-bank/components/CategoryColorChip";

interface CategoryManagerProps {
  categories: QuestionCategory[];
  onChange: (categories: QuestionCategory[]) => void;
}

export function CategoryManager({ categories, onChange }: CategoryManagerProps): React.JSX.Element {
  const { t } = useTranslation();

  const update = (id: string, patch: Partial<QuestionCategory>): void => {
    onChange(
      categories.map((category) => (category.id === id ? { ...category, ...patch } : category)),
    );
  };

  const addCategory = (): void => {
    onChange([...categories, createQuestionCategory(t("questionBank.newCategory"), categories)]);
  };

  const removeCategory = (id: string): void => {
    onChange(categories.filter((category) => category.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionLabel as="h4" weight="bold" tracking="wide" className="m-0 min-w-0">
          {t("questionBank.categoriesTitle")}
        </SectionLabel>
        <Button
          type="button"
          onClick={addCategory}
          variant="outline"
          className="flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold shadow-none hover:bg-muted sm:w-auto"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t("questionBank.addCategory")}
        </Button>
      </div>
      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-2 sm:grid-row-category-5"
          >
            <Input
              id={`cat-icon-${cat.id}`}
              name={`category.${cat.id}.icon`}
              type="text"
              className="w-12 rounded-lg border border-border bg-background px-2 py-1.5 min-h-11 text-center text-sm shadow-none"
              value={cat.icon}
              onChange={(event) => update(cat.id, { icon: event.target.value })}
              aria-label={t("questionBank.categoryIcon")}
            />
            <Input
              id={`cat-name-${cat.id}`}
              name={`category.${cat.id}.name`}
              type="text"
              className={`${FORM_INPUT} min-h-11 shadow-none`}
              value={cat.name}
              onChange={(event) => update(cat.id, { name: event.target.value })}
              aria-label={t("questionBank.categoryName")}
            />
            <Input
              id={`cat-color-${cat.id}`}
              name={`category.${cat.id}.color`}
              type="color"
              className="min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background p-0.5 shadow-none"
              value={cat.color}
              onChange={(event) => update(cat.id, { color: event.target.value })}
              aria-label={t("questionBank.categoryColor")}
            />
            <CategoryColorChip name={cat.name} color={cat.color} />
            <Button
              type="button"
              onClick={() => removeCategory(cat.id)}
              variant="ghost"
              size="icon"
              className="rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive shadow-none"
              aria-label={t("questionBank.removeCategory")}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
