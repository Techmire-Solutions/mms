import React from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REMOVE_BTN } from "@/components/ui/formPrimitiveStyles";
import { formatContactOptionLabel } from "@/lib/contacts/contactI18n";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { cn } from "@/lib/utils";

export interface EditableMultiSelectOptionItemProps {
  option: string;
  index: number;
  resolvedId: string;
  isSelected: boolean;
  isHighlighted: boolean;
  canRemoveOptions: boolean;
  t: TranslationFunction;
  onHoverOption?: (index: number) => void;
  onToggleOption: (option: string) => void;
  onRemoveOption: (option: string, event: React.MouseEvent) => void;
}

export const EditableMultiSelectOptionItem = React.memo(function EditableMultiSelectOptionItem({
  option,
  index,
  resolvedId,
  isSelected,
  isHighlighted,
  canRemoveOptions,
  t,
  onHoverOption,
  onToggleOption,
  onRemoveOption,
}: EditableMultiSelectOptionItemProps): React.JSX.Element {
  return (
    <div
      id={`${resolvedId}-opt-${index}`}
      role="option"
      aria-selected={isSelected}
      onMouseEnter={() => onHoverOption?.(index)}
      onClick={() => onToggleOption(option)}
      className={cn(
        "flex min-h-9 items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors select-none",
        isSelected
          ? isHighlighted
            ? "bg-primary/15 text-primary font-medium"
            : "bg-primary/10 text-primary font-medium"
          : isHighlighted
            ? "bg-muted/80 text-foreground"
            : "text-foreground hover:bg-muted/60",
      )}
    >
      <span className="truncate flex-1">{formatContactOptionLabel(option, t) || option}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
            isSelected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/40 bg-background",
          )}
        >
          {isSelected && <Check strokeWidth={2.5} className="w-3 h-3" />}
        </div>
        {canRemoveOptions && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => onRemoveOption(option, event)}
            className={cn(
              "relative h-7 w-7 rounded transition-colors after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
              REMOVE_BTN,
            )}
            aria-label={t("contacts.form.removeOption", { option })}
          >
            <X className="w-3.5 h-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
});
