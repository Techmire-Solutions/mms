import { useMemo, useState, type KeyboardEvent } from "react";
import { isImeSafeEnter } from "../utils";

export interface FormSelectSearchOption {
  value: string;
  label: string;
  disabled?: boolean;
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

export interface UseFormSelectSearchArgs {
  options: readonly FormSelectSearchOption[];
  value: string;
  onPick: (value: string) => void;
  /**
   * Reports every query change so a remote search can refetch the option list.
   * When set, callers usually also set `filterLocally: false` so matches the
   * server found on other fields (email, CNIC, phone) are not filtered out.
   */
  onQueryChange?: (query: string) => void;
  /** Set false when `onQueryChange` drives a remote option list. Defaults true. */
  filterLocally?: boolean;
}

/** Open/query/highlight state for the searchable FormSelect popover. */
export function useFormSelectSearch({
  options,
  value,
  onPick,
  onQueryChange,
  filterLocally = true,
}: UseFormSelectSearchArgs) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const filtered = useMemo(() => {
    if (filterLocally) return filterSelectOptions(options, query);
    // Remote results are already matched by the caller; only drop the empty
    // placeholder while a query is active, mirroring local filtering.
    if (!query.trim()) return [...options];
    return options.filter((option) => option.value !== "");
  }, [filterLocally, options, query]);

  const openWith = (initialQuery = ""): void => {
    setQuery(initialQuery);
    onQueryChange?.(initialQuery);
    const selectedIndex = options.findIndex((option) => option.value === value);
    setHighlightedIndex(initialQuery || selectedIndex < 0 ? 0 : selectedIndex);
    setOpen(true);
  };

  const close = (): void => {
    setOpen(false);
    setQuery("");
    if (query !== "") onQueryChange?.("");
  };

  const changeQuery = (next: string): void => {
    setQuery(next);
    onQueryChange?.(next);
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
    } else if (event.key === "Enter" && isImeSafeEnter(event)) {
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
