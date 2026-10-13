import React from "react";
import { X } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { formatContactOptionLabel } from "@/lib/contacts/contactI18n";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { isOptionSelected } from "@/components/app/editableMultiSelectUtils";
import {
  EditableMultiSelectOptionItem,
  type EditableMultiSelectOptionItemProps,
} from "@/components/app/EditableMultiSelectOptionItem";
import {
  EditableMultiSelectSearchBar,
  type EditableMultiSelectSearchBarProps,
} from "@/components/app/EditableMultiSelectSearchBar";

export { EditableMultiSelectOptionItem, EditableMultiSelectSearchBar };
export type { EditableMultiSelectOptionItemProps, EditableMultiSelectSearchBarProps };

interface EditableMultiSelectChipRowProps {
  values: string[];
  placeholder: string;
  t: TranslationFunction;
  onRemoveValue: (valToRemove: string, event: React.SyntheticEvent) => void;
  maxVisible?: number;
}

export const EditableMultiSelectChipRow = React.memo(function EditableMultiSelectChipRow({
  values,
  placeholder,
  t,
  onRemoveValue,
  maxVisible,
}: EditableMultiSelectChipRowProps): React.JSX.Element {
  if (values.length === 0) {
    return <span className="text-muted-foreground select-none">{placeholder}</span>;
  }

  const visibleValues =
    maxVisible && values.length > maxVisible ? values.slice(0, maxVisible) : values;
  const remainingCount = maxVisible && values.length > maxVisible ? values.length - maxVisible : 0;

  return (
    <>
      {visibleValues.map((val) => (
        <Badge key={val} tone="primary" className="gap-1 px-2 py-0.5 text-xs font-medium">
          <span>{formatContactOptionLabel(val, t) || val}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => onRemoveValue(val, e)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRemoveValue(val, e);
              }
            }}
            className="relative inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/15 text-primary hover:text-destructive transition-colors cursor-pointer after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
            aria-label={t("contacts.form.removeTag", { tag: val })}
          >
            <X className="w-3 h-3" />
          </span>
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge tone="muted" className="px-1.5 py-0.5 text-xs font-semibold">
          +{remainingCount}
        </Badge>
      )}
    </>
  );
});

interface EditableMultiSelectOptionListProps {
  resolvedId: string;
  listboxId: string;
  filteredOptions: string[];
  values: string[];
  canRemoveOptions: boolean;
  t: TranslationFunction;
  highlightedIndex?: number;
  onHoverOption?: (index: number) => void;
  onToggleOption: (option: string) => void;
  onRemoveOption: (option: string, event: React.MouseEvent) => void;
}

export const EditableMultiSelectOptionList = React.memo(function EditableMultiSelectOptionList({
  resolvedId,
  listboxId,
  filteredOptions,
  values,
  canRemoveOptions,
  t,
  highlightedIndex = -1,
  onHoverOption,
  onToggleOption,
  onRemoveOption,
}: EditableMultiSelectOptionListProps): React.JSX.Element {
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const isVirtualized = filteredOptions.length > 50;

  const rowVirtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 6,
    enabled: isVirtualized,
  });

  React.useEffect(() => {
    if (isVirtualized && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
      rowVirtualizer.scrollToIndex(highlightedIndex, { align: "auto" });
    }
  }, [highlightedIndex, isVirtualized, filteredOptions.length, rowVirtualizer]);

  return (
    <div
      ref={parentRef}
      id={listboxId}
      role="listbox"
      aria-multiselectable="true"
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 max-h-48"
    >
      {filteredOptions.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground text-center">
          {t("common.none")}
        </div>
      ) : isVirtualized ? (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const option = filteredOptions[virtualRow.index];
            const isSelected = isOptionSelected(values, option);
            const isHighlighted = virtualRow.index === highlightedIndex;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <EditableMultiSelectOptionItem
                  option={option}
                  index={virtualRow.index}
                  resolvedId={resolvedId}
                  isSelected={isSelected}
                  isHighlighted={isHighlighted}
                  canRemoveOptions={canRemoveOptions}
                  t={t}
                  onHoverOption={onHoverOption}
                  onToggleOption={onToggleOption}
                  onRemoveOption={onRemoveOption}
                />
              </div>
            );
          })}
        </div>
      ) : (
        filteredOptions.map((option, index) => {
          const isSelected = isOptionSelected(values, option);
          const isHighlighted = index === highlightedIndex;
          return (
            <EditableMultiSelectOptionItem
              key={option}
              option={option}
              index={index}
              resolvedId={resolvedId}
              isSelected={isSelected}
              isHighlighted={isHighlighted}
              canRemoveOptions={canRemoveOptions}
              t={t}
              onHoverOption={onHoverOption}
              onToggleOption={onToggleOption}
              onRemoveOption={onRemoveOption}
            />
          );
        })
      )}
    </div>
  );
});
