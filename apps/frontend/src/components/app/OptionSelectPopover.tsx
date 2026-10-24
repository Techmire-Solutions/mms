import React, { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { DropdownSelectBase } from "@/components/app/DropdownSelectBase";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { formatContactOptionLabel } from "@/lib/contacts/contactI18n";
import { cn } from "@/lib/utils";
import { REMOVE_BTN } from "@/components/ui/formPrimitiveStyles";
import { EditableMultiSelectSearchBar } from "@/components/app/EditableMultiSelectSearchBar";
import {
  FORM_SELECT_SEARCH_MIN_OPTIONS,
  filterSelectOptions,
} from "@/components/app/useFormSelectSearch";

export interface OptionSelectPopoverProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  /** When set, each option shows a remove control that updates the options list. */
  onUpdateOptions?: (options: string[]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  onOpenChange?: (open: boolean) => void;
  /** Rendered below the option list; `close` dismisses the popover. */
  footer?: (api: { close: () => void }) => ReactNode;
}

/**
 * Option listbox popover built on DropdownSelectBase, used by EditableSelect.
 */
export function OptionSelectPopover({
  options,
  value,
  onChange,
  onUpdateOptions,
  placeholder,
  className = "w-28",
  id,
  name,
  onOpenChange,
  footer,
}: OptionSelectPopoverProps): React.JSX.Element {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("contacts.form.selectOption");
  const canRemoveOptions = Boolean(onUpdateOptions);
  const [query, setQuery] = useState("");
  const isSearchable = options.length >= FORM_SELECT_SEARCH_MIN_OPTIONS;
  const visibleOptions = useMemo(() => {
    if (!isSearchable || !query.trim()) return options;
    const labelled = options.map((option) => ({
      value: option,
      label: formatContactOptionLabel(option, t),
    }));
    return filterSelectOptions(labelled, query).map((option) => option.value);
  }, [isSearchable, options, query, t]);

  const handleRemove = (option: string, event: React.MouseEvent): void => {
    if (!onUpdateOptions) return;
    event.stopPropagation();
    const nextOptions = options.filter((opt) => opt !== option);
    onUpdateOptions(nextOptions);
    if (value === option) {
      onChange(nextOptions[0] || "");
    }
  };

  return (
    <DropdownSelectBase
      id={id}
      options={visibleOptions}
      value={value}
      onSelect={onChange}
      onOpenChange={(open) => {
        if (!open) setQuery("");
        onOpenChange?.(open);
      }}
      header={
        isSearchable
          ? ({ setHighlightedIndex }) => (
              <EditableMultiSelectSearchBar
                searchQuery={query}
                onSearchChange={(next) => {
                  setQuery(next);
                  setHighlightedIndex(0);
                }}
                onClearSearch={() => {
                  setQuery("");
                  setHighlightedIndex(0);
                }}
                t={t}
              />
            )
          : undefined
      }
      footer={footer}
      renderTrigger={({ open, triggerProps }) => (
        <button
          type="button"
          {...triggerProps}
          name={name}
          aria-label={resolvedPlaceholder}
          className={cn(
            "min-h-11 flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-all text-start cursor-pointer",
            className,
          )}
        >
          <span className="truncate">
            {formatContactOptionLabel(value, t) || resolvedPlaceholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
    >
      {({ highlightedIndex, setHighlightedIndex, select, listboxId }) => (
        <>
          {visibleOptions.map((option, index) => {
            const isSelected = value === option;
            const isHighlighted = index === highlightedIndex;
            return (
              <div
                key={option}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => select(option)}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer transition-colors",
                  isSelected
                    ? "bg-primary/5 text-primary font-semibold"
                    : isHighlighted
                      ? "bg-muted/70 text-foreground"
                      : "text-foreground",
                )}
              >
                <span className="truncate flex items-center gap-2">
                  <Check
                    className={cn(
                      "w-3.5 h-3.5 flex-shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{formatContactOptionLabel(option, t)}</span>
                </span>
                {canRemoveOptions ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(event) => handleRemove(option, event)}
                    className={cn("rounded transition-colors", REMOVE_BTN)}
                    aria-label={t("contacts.form.removeOption", { option })}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            );
          })}
          {visibleOptions.length === 0 && (
            <div role="status" className="px-3 py-2 text-sm text-muted-foreground italic">
              {t(options.length === 0 ? "contacts.form.noOptions" : "common.noMatchingOptions")}
            </div>
          )}
        </>
      )}
    </DropdownSelectBase>
  );
}
