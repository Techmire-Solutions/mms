import React from "react";
import type { AppTranslationKey } from "@mms/shared";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isImeSafeEnter } from "@/lib/utils";

export interface CategoryCreateInlineFormProps {
  newName: string;
  onChangeNewName: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
}

export function CategoryCreateInlineForm({
  newName,
  onChangeNewName,
  onCreate,
  onCancel,
  t,
}: CategoryCreateInlineFormProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row">
      <Input
        id="new-category-name"
        name="newCategoryName"
        type="text"
        className={`${FORM_INPUT} shadow-none`}
        value={newName}
        onChange={(e) => onChangeNewName(e.target.value)}
        placeholder={t("questionBank.newCategoryName")}
        aria-label={t("questionBank.newCategoryName")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && isImeSafeEnter(e)) {
            e.preventDefault();
            onCreate();
          }
        }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onCreate}
          disabled={!newName.trim()}
          className="rounded-lg bg-primary min-h-11 h-auto px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t("questionBank.createCategory")}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="rounded-lg border border-border min-h-11 h-auto px-3 py-2 text-xs font-medium hover:bg-muted shadow-none"
        >
          {t("questionBank.cancel")}
        </Button>
      </div>
    </div>
  );
}
