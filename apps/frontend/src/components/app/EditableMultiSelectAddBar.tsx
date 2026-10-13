import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FORM_INPUT_COMPACT } from "@/components/ui/formStyles";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { cn } from "@/lib/utils";

const INPUT_CLASS = cn("h-auto min-w-0 flex-1", FORM_INPUT_COMPACT);

export interface EditableMultiSelectAddBarProps {
  newTagValue: string;
  onNewTagChange: (value: string) => void;
  onAdd: (value?: string) => void;
  addInputLabel: string;
  t: TranslationFunction;
}

export const EditableMultiSelectAddBar = React.memo(function EditableMultiSelectAddBar({
  newTagValue,
  onNewTagChange,
  onAdd,
  addInputLabel,
  t,
}: EditableMultiSelectAddBarProps): React.JSX.Element {
  return (
    <div className="p-2 space-y-1.5 bg-muted/20 flex-shrink-0">
      <div className="flex gap-1.5">
        <Input
          type="text"
          value={newTagValue}
          onChange={(e) => {
            const val = e.target.value;
            if (val.includes(",")) {
              onAdd(val);
            } else {
              onNewTagChange(val);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              e.stopPropagation();
              onAdd();
            }
          }}
          placeholder={addInputLabel}
          aria-label={addInputLabel}
          className={INPUT_CLASS}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => onAdd()}
          disabled={!newTagValue.trim()}
          className="px-2.5 min-h-11 text-xs font-semibold rounded-lg flex-shrink-0 gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("common.add")}
        </Button>
      </div>
    </div>
  );
});
