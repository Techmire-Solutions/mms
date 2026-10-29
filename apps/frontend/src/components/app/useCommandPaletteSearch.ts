import { useState, useDeferredValue, useMemo } from "react";
import { isImeSafeEnter } from "@shared/ui";

export interface UseCommandPaletteSearchOptions<T> {
  filterItems: (query: string) => readonly T[];
  onSelect: (item: T) => void;
  onClose: () => void;
}

/**
 * Headless keyboard navigation and selection state for command palette modals.
 */
export function useCommandPaletteSearch<T>({
  filterItems,
  onSelect,
  onClose,
}: UseCommandPaletteSearchOptions<T>) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [requestedIndex, setSelectedIndex] = useState(0);
  const items = useMemo(() => filterItems(deferredQuery), [filterItems, deferredQuery]);
  const selectedIndex = Math.max(0, Math.min(requestedIndex, items.length - 1));

  // A new query always starts from the first result. Adjusted during render
  // rather than in an effect so the highlight never flashes on the old row.
  const [previousQuery, setPreviousQuery] = useState(query);
  if (previousQuery !== query) {
    setPreviousQuery(query);
    setSelectedIndex(0);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(() => (items.length > 0 ? (selectedIndex + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(() =>
        items.length > 0 ? (selectedIndex - 1 + items.length) % items.length : 0,
      );
    } else if (e.key === "Enter" && isImeSafeEnter(e)) {
      e.preventDefault();
      if (items[selectedIndex]) {
        onSelect(items[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return {
    filteredItems: items,
    query,
    setQuery,
    deferredQuery,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
  };
}
