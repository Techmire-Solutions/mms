import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect, type FormSelectProps } from "@/components/ui/FormSelect";
import { cn } from "@/lib/utils";

export interface FormSelectWithQuickCreateProps extends FormSelectProps {
  /** When true, show the Plus control that opens catalog create. */
  canAdd?: boolean;
  onOpenAdd?: () => void;
  addAriaLabel: string;
}

/**
 * SSOT for entity-catalog selects: FormSelect + optional Plus that opens a
 * nested catalog FormModal. String lookups continue to use EditableSelect.
 */
export function FormSelectWithQuickCreate({
  canAdd = false,
  onOpenAdd,
  addAriaLabel,
  disabled = false,
  className,
  ...selectProps
}: FormSelectWithQuickCreateProps): React.JSX.Element {
  const showAdd = canAdd && typeof onOpenAdd === "function" && !disabled;

  return (
    <div className={cn("flex items-end gap-2", className)}>
      <div className="min-w-0 flex-1">
        <FormSelect {...selectProps} disabled={disabled} />
      </div>
      {showAdd ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11 shrink-0"
          onClick={onOpenAdd}
          aria-label={addAriaLabel}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
