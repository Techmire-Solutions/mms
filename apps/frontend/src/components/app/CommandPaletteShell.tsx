import React from "react";
import { CommandPaletteModal } from "@/components/app/CommandPaletteModal";
import {
  useCommandPaletteSearch,
  type UseCommandPaletteSearchOptions,
} from "@/components/app/useCommandPaletteSearch";

export interface CommandPaletteShellRenderCtx<T> {
  query: string;
  setQuery: (q: string) => void;
  filteredItems: readonly T[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
}

export interface CommandPaletteShellProps<T> {
  open: boolean;
  onClose: () => void;
  filterItems: UseCommandPaletteSearchOptions<T>["filterItems"];
  onSelect: UseCommandPaletteSearchOptions<T>["onSelect"];
  ariaLabel: string;
  searchPlaceholder: string;
  listboxId: string;
  getActiveDescendantId: (item: T) => string;
  getScreenReaderAnnouncement?: (query: string, items: readonly T[]) => string | undefined;
  footerTitle?: string;
  dialogClassName?: string;
  children: (ctx: CommandPaletteShellRenderCtx<T>) => React.ReactNode;
}

/**
 * Shared command-palette shell — modal chrome + keyboard search state.
 * Prefer this over hand-rolling CommandPaletteModal + useCommandPaletteSearch.
 */
export function CommandPaletteShell<T>({
  open,
  onClose,
  filterItems,
  onSelect,
  ariaLabel,
  searchPlaceholder,
  listboxId,
  getActiveDescendantId,
  getScreenReaderAnnouncement,
  footerTitle,
  dialogClassName,
  children,
}: CommandPaletteShellProps<T>): React.JSX.Element | null {
  const { query, setQuery, filteredItems, selectedIndex, setSelectedIndex, handleKeyDown } =
    useCommandPaletteSearch<T>({
      filterItems,
      onSelect,
      onClose,
    });

  const activeItem = filteredItems[selectedIndex];

  return (
    <CommandPaletteModal
      open={open}
      onClose={onClose}
      ariaLabel={ariaLabel}
      searchPlaceholder={searchPlaceholder}
      query={query}
      onQueryChange={setQuery}
      onKeyDown={handleKeyDown}
      screenReaderAnnouncement={getScreenReaderAnnouncement?.(query, filteredItems)}
      listboxId={listboxId}
      activeDescendantId={activeItem ? getActiveDescendantId(activeItem) : undefined}
      footerTitle={footerTitle}
      dialogClassName={dialogClassName}
    >
      {children({
        query,
        setQuery,
        filteredItems,
        selectedIndex,
        setSelectedIndex,
      })}
    </CommandPaletteModal>
  );
}
