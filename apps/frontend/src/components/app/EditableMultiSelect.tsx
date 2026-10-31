import React, { useId } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import {
  EditableMultiSelectChipRow,
  EditableMultiSelectOptionList,
  EditableMultiSelectSearchBar,
} from "@/components/app/EditableMultiSelectParts";
import { EditableMultiSelectAddBar } from "@/components/app/EditableMultiSelectAddBar";
import { useEditableMultiSelectState } from "@/components/app/useEditableMultiSelectState";

export interface EditableMultiSelectProps {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  onUpdateOptions?: (options: string[]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  addPlaceholder?: string;
  error?: boolean;
  /** Maximum number of chips to display before summarizing with a +n count badge (P2-4). */
  maxVisible?: number;
}

export function EditableMultiSelect({
  options,
  values = [],
  onChange,
  onUpdateOptions,
  placeholder,
  className = "w-full",
  id,
  name,
  addPlaceholder,
  error = false,
  maxVisible,
}: EditableMultiSelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const state = useEditableMultiSelectState({
    options,
    values,
    onChange,
    onUpdateOptions,
    triggerRef,
  });

  const fallbackId = useId();
  const resolvedId = id || fallbackId;
  const resolvedName = name || fallbackId;
  const listboxId = `${resolvedId}-multi-listbox`;
  const resolvedPlaceholder = placeholder ?? t("contacts.form.selectOption");
  const addInputLabel = addPlaceholder ?? t("contacts.form.addNewTypePlaceholder");

  return (
    <Popover
      open={state.open}
      onOpenChange={(isOpen) => {
        if (!isOpen && state.newTagValue.trim()) {
          state.handleAdd(state.newTagValue);
        }
        state.setOpen(isOpen);
        state.setHighlightedIndex(isOpen ? 0 : -1);
        if (!isOpen) {
          state.setSearchQuery("");
          state.setNewTagValue("");
        }
      }}
    >
      <PopoverTrigger
        ref={triggerRef}
        type="button"
        id={resolvedId}
        name={resolvedName}
        aria-label={resolvedPlaceholder}
        aria-expanded={state.open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-invalid={Boolean(error)}
        className={cn(
          "min-h-11 w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-all text-start cursor-pointer touch-manipulation",
          error && FORM_INPUT_ERROR,
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          <EditableMultiSelectChipRow
            values={values}
            placeholder={resolvedPlaceholder}
            t={t}
            onRemoveValue={state.removeValue}
            maxVisible={maxVisible}
          />
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform",
            state.open && "rotate-180",
          )}
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-64 max-h-80 flex flex-col overflow-hidden rounded-xl surface-overlay divide-y divide-border/60"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (state.filteredOptions.length === 0) return;
            state.setHighlightedIndex((prev) => (prev + 1) % state.filteredOptions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (state.filteredOptions.length === 0) return;
            state.setHighlightedIndex(
              (prev) => (prev - 1 + state.filteredOptions.length) % state.filteredOptions.length,
            );
          } else if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "INPUT") {
            const highlighted = state.filteredOptions[state.highlightedIndex];
            if (highlighted !== undefined) {
              event.preventDefault();
              state.toggleOption(highlighted);
            }
          }
        }}
      >
        {options.length > 4 && (
          <EditableMultiSelectSearchBar
            searchQuery={state.searchQuery}
            onSearchChange={(query) => {
              state.setSearchQuery(query);
              state.setHighlightedIndex(0);
            }}
            onClearSearch={() => {
              state.setSearchQuery("");
              state.setHighlightedIndex(0);
            }}
            t={t}
          />
        )}

        <EditableMultiSelectOptionList
          resolvedId={resolvedId}
          listboxId={listboxId}
          filteredOptions={state.filteredOptions}
          values={values}
          canRemoveOptions={state.canRemoveOptions}
          t={t}
          highlightedIndex={state.highlightedIndex}
          onHoverOption={state.setHighlightedIndex}
          onToggleOption={state.toggleOption}
          onRemoveOption={state.handleRemoveOption}
        />

        <EditableMultiSelectAddBar
          newTagValue={state.newTagValue}
          onNewTagChange={state.setNewTagValue}
          onAdd={state.handleAdd}
          addInputLabel={addInputLabel}
          t={t}
        />
      </PopoverContent>
    </Popover>
  );
}
