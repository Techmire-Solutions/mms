import { useState, useCallback, type KeyboardEvent } from "react";

export interface UseDropdownListboxOptions<T = string> {
  options: readonly T[];
  value?: T | readonly T[];
  onSelect?: (option: T) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function useDropdownListbox<T = string>({
  options,
  value,
  onSelect,
  isOpen: controlledOpen,
  onOpenChange,
}: UseDropdownListboxOptions<T>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);

      if (nextOpen) {
        const initialIndex = Array.isArray(value) ? 0 : options.findIndex((opt) => opt === value);
        setHighlightedIndex(initialIndex >= 0 ? initialIndex : 0);
      } else {
        setHighlightedIndex(-1);
        setSearchQuery("");
      }
    },
    [isControlled, onOpenChange, options, value],
  );

  const moveHighlight = useCallback(
    (direction: 1 | -1) => {
      if (options.length === 0) return;
      setHighlightedIndex((prev) => {
        const start = prev < 0 ? (direction === 1 ? -1 : 0) : prev;
        return (start + direction + options.length) % options.length;
      });
    },
    [options.length],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveHighlight(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveHighlight(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        if (options.length > 0) setHighlightedIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        if (options.length > 0) setHighlightedIndex(options.length - 1);
      } else if (
        event.key === "Enter" &&
        ((event.target as HTMLElement).tagName !== "INPUT" ||
          (event.target as HTMLElement).dataset.listboxSearch !== undefined)
      ) {
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          event.preventDefault();
          const selected = options[highlightedIndex];
          if (selected !== undefined && onSelect) {
            onSelect(selected);
          }
        }
      }
    },
    [highlightedIndex, moveHighlight, onSelect, options],
  );

  return {
    open,
    setOpen,
    highlightedIndex,
    setHighlightedIndex,
    searchQuery,
    setSearchQuery,
    moveHighlight,
    handleKeyDown,
  };
}
