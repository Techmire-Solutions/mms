import React, { useEffect, useRef } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PopoverContent } from "@/components/ui/popover";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { FormSelectSearchState } from "@/components/app/useFormSelectSearch";

interface FormSelectSearchContentProps {
  baseId: string;
  value: string;
  search: FormSelectSearchState;
  /** Element that regains focus when the popover closes via keyboard or pick. */
  returnFocusRef: React.RefObject<HTMLSelectElement | null>;
  ariaLabel?: string;
}

/** Search box + filtered listbox rendered inside the FormSelect popover. */
export function FormSelectSearchContent({
  baseId,
  value,
  search,
  returnFocusRef,
  ariaLabel,
}: FormSelectSearchContentProps): React.JSX.Element {
  const { t } = useTranslation();
  const interactedOutsideRef = useRef(false);
  const listboxId = `${baseId}-search-listbox`;
  const optionId = (index: number): string => `${baseId}-search-opt-${index}`;
  const { filtered, highlightedIndex } = search;
  const activeId = filtered[highlightedIndex] ? optionId(highlightedIndex) : undefined;

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  return (
    <PopoverContent
      align="start"
      sideOffset={4}
      collisionPadding={8}
      className="flex max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] min-w-popover-lg flex-col overflow-hidden rounded-xl p-0 surface-overlay"
      onOpenAutoFocus={() => {
        interactedOutsideRef.current = false;
      }}
      onInteractOutside={() => {
        interactedOutsideRef.current = true;
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (!interactedOutsideRef.current) returnFocusRef.current?.focus();
      }}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label={ariaLabel ? `${t("common.search")}: ${ariaLabel}` : t("common.search")}
          placeholder={t("common.searchPlaceholder")}
          autoComplete="off"
          value={search.query}
          onChange={(event) => search.changeQuery(event.target.value)}
          onKeyDown={search.handleSearchKeyDown}
          className="h-11 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <div
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        className="max-h-80 min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
      >
        {filtered.map((option, index) => {
          const isSelected = option.value === value;
          return (
            <div
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={isSelected}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => {
                if (index !== highlightedIndex) search.setHighlightedIndex(index);
              }}
              onClick={() => search.pick(option)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                index === highlightedIndex ? "bg-muted/70" : undefined,
                isSelected ? "font-semibold text-primary" : "text-foreground",
                option.value === "" && !isSelected ? "text-muted-foreground" : undefined,
              )}
            >
              <Check
                className={cn("size-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                aria-hidden
              />
              <span className="min-w-0 flex-1 break-words">{option.label}</span>
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p role="status" className="px-3 py-2 text-sm italic text-muted-foreground">
            {t("common.noMatchingOptions")}
          </p>
        ) : null}
      </div>
    </PopoverContent>
  );
}
