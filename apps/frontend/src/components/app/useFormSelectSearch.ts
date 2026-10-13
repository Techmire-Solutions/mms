import { useMemo, useState, type KeyboardEvent } from "react";

export interface FormSelectSearchOption {
  value: string;
  label: string;
}

/** Selects with at least this many choices open the searchable popover. */
export const FORM_SELECT_SEARCH_MIN_OPTIONS = 6;

const foldText = (text: string): string =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

export function filterSelectOptions(
  options: readonly FormSelectSearchOption[],
  query: string,
): FormSelectSearchOption[] {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...options];
  return options.filter((option) => {
    if (option.value === "") return false;
    const haystack = foldText(option.label);
    return terms.every((term) => haystack.includes(term));
  });
}

interface UseFormSelectSearchArgs {
  options: readonly FormSelectSearchOption[];
  value: string;
  onPick: (value: string) => void;
}

/** Open/query/highlight state for the searchable FormSelect popover. */
export function useFormSelectSearch({ options, value, onPick }: UseFormSelectSearchArgs) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const filtered = useMemo(() => filterSelectOptions(options, query), [options, query]);

  const openWith = (initialQuery = ""): void => {
    setQuery(initialQuery);
    const selectedIndex = options.findIndex((option) => option.value === value);
    setHighlightedIndex(initialQuery || selectedIndex < 0 ? 0 : selectedIndex);
    setOpen(true);
  };

  const close = (): void => {
    setOpen(false);
    setQuery("");
  };

  const changeQuery = (next: string): void => {
    setQuery(next);
    setHighlightedIndex(0);
  };

  const pick = (option: FormSelectSearchOption): void => {
    onPick(option.value);
    close();
  };

  const moveTo = (index: number): void => {
    if (filtered.length === 0) return;
    setHighlightedIndex(Math.min(Math.max(index, 0), filtered.length - 1));
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 };
    if (event.key in steps) {
      event.preventDefault();
      moveTo(highlightedIndex + (steps[event.key] ?? 0));
    } else if (event.key === "Home" && event.ctrlKey) {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === "End" && event.ctrlKey) {
      event.preventDefault();
      moveTo(filtered.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlightedIndex];
      if (option) pick(option);
    } else if (event.key === "Tab") {
      close();
    }
  };

  return {
    open,
    query,
    filtered,
    highlightedIndex,
    setHighlightedIndex,
    openWith,
    close,
    changeQuery,
    pick,
    handleSearchKeyDown,
  };
}

export type FormSelectSearchState = ReturnType<typeof useFormSelectSearch>;
