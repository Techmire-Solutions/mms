import React, { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  buildAddedTags,
  filterOptionsByQuery,
  removeOptionFromCatalog,
  removeSelectedValue,
  toggleSelectedValue,
} from "@/components/app/editableMultiSelectUtils";

export interface UseEditableMultiSelectStateParams {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  onUpdateOptions?: (options: string[]) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function useEditableMultiSelectState({
  options,
  values,
  onChange,
  onUpdateOptions,
  triggerRef,
}: UseEditableMultiSelectStateParams) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [newTagValue, setNewTagValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const internalTriggerRef = React.useRef<HTMLButtonElement>(null);
  const resolvedTriggerRef = triggerRef ?? internalTriggerRef;

  const canRemoveOptions = Boolean(onUpdateOptions);

  const toggleOption = useCallback(
    (option: string): void => {
      onChange(toggleSelectedValue(values, option));
    },
    [onChange, values],
  );

  const removeValue = useCallback(
    (valToRemove: string, event: React.SyntheticEvent): void => {
      event.stopPropagation();
      onChange(removeSelectedValue(values, valToRemove));
      resolvedTriggerRef.current?.focus();
    },
    [onChange, resolvedTriggerRef, values],
  );

  const handleRemoveOption = useCallback(
    (option: string, event: React.MouseEvent): void => {
      if (!onUpdateOptions) return;
      event.stopPropagation();
      const { nextOptions, nextValues } = removeOptionFromCatalog(options, values, option);
      onUpdateOptions(nextOptions);
      onChange(nextValues);
    },
    [onChange, onUpdateOptions, options, values],
  );

  const handleAdd = useCallback(
    (valueToAdd?: string): void => {
      const rawText = (valueToAdd ?? newTagValue).trim();
      if (!rawText) return;

      const { nextValues, nextOptions, optionsChanged } = buildAddedTags(
        rawText,
        options,
        values,
        canRemoveOptions,
      );

      if (optionsChanged && onUpdateOptions) {
        onUpdateOptions(nextOptions);
      }
      onChange(nextValues);
      setNewTagValue("");
    },
    [canRemoveOptions, newTagValue, onChange, onUpdateOptions, options, values],
  );

  const filteredOptions = useMemo(
    () => filterOptionsByQuery(options, deferredSearchQuery),
    [options, deferredSearchQuery],
  );

  return {
    open,
    setOpen,
    searchQuery,
    setSearchQuery,
    newTagValue,
    setNewTagValue,
    highlightedIndex,
    setHighlightedIndex,
    canRemoveOptions,
    toggleOption,
    removeValue,
    handleRemoveOption,
    handleAdd,
    filteredOptions,
  };
}
