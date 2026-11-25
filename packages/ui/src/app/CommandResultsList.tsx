import React from "react";
import { Clock } from "lucide-react";
import { cn } from "@mms/ui";

export interface CommandResultsSection<T> {
  /** Display label; sections whose category equals `recentsCategoryKey` get the clock icon + `recentsLabel`. */
  category: string;
  items: readonly T[];
}

export interface CommandResultsListProps<T> {
  /** Ordered flat items matching the keyboard-selection index. */
  flatItems: readonly T[];
  /** Grouped sections in display order. */
  sections: readonly CommandResultsSection<T>[];
  selectedIndex: number;
  listboxId: string;
  getItemId: (item: T) => string;
  onSelect: (item: T) => void;
  onHoverIndex: (index: number) => void;
  /** Optional extra hover side effect (e.g. route prefetch). */
  onHoverItem?: (item: T) => void;
  /** Category sentinel rendered with the recents clock icon. */
  recentsCategoryKey?: string;
  recentsLabel?: string;
  emptyState?: React.ReactNode;
  /** Scroll-container class overrides (console-specific max-height/padding). */
  scrollClassName?: string;
  /** Category-header class overrides (console-specific typography). */
  categoryHeaderClassName?: string;
  /** Extra row classes; pass a function to vary by selection state. */
  rowClassName?: string | ((isSelected: boolean) => string);
  /** Row content — label, meta, badge, shortcut. The icon is console-specific. */
  renderRow: (item: T, isSelected: boolean) => React.ReactNode;
}

/**
 * Console-agnostic command palette results list: category grouping, keyboard
 * selection/hover row rendering with the `bg-primary text-primary-foreground`
 * selected treatment, recents section, and listbox ARIA wiring. Tenant and
 * Platform consoles supply their row content and styling via props.
 */
export function CommandResultsList<T>({
  flatItems,
  sections,
  selectedIndex,
  listboxId,
  getItemId,
  onSelect,
  onHoverIndex,
  onHoverItem,
  recentsCategoryKey,
  recentsLabel,
  emptyState,
  scrollClassName,
  categoryHeaderClassName,
  rowClassName,
  renderRow,
}: CommandResultsListProps<T>): React.JSX.Element {
  return (
    <div
      className={cn(
        "max-h-[min(60vh,20rem)] scroll-py-2 overflow-y-auto p-2 pb-3",
        scrollClassName,
      )}
      role="listbox"
      id={listboxId}
    >
      {flatItems.length === 0
        ? emptyState
        : sections.map(({ category, items }) => {
            const isRecents = category === recentsCategoryKey;
            return (
              <div key={category} className="mb-1">
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-muted-foreground select-none",
                    categoryHeaderClassName,
                  )}
                  aria-hidden="true"
                >
                  {isRecents && <Clock className="h-3 w-3" aria-hidden="true" />}
                  {isRecents ? recentsLabel : category}
                </div>
                {items.map((item) => {
                  const globalIndex = flatItems.indexOf(item);
                  const isSelected = globalIndex === selectedIndex;
                  return (
                    <button
                      key={getItemId(item)}
                      id={getItemId(item)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelect(item)}
                      onMouseEnter={() => {
                        onHoverIndex(globalIndex);
                        onHoverItem?.(item);
                      }}
                      className={cn(
                        "flex w-full min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "text-foreground hover:bg-muted/70",
                        typeof rowClassName === "function"
                          ? rowClassName(isSelected)
                          : rowClassName,
                      )}
                    >
                      {renderRow(item, isSelected)}
                    </button>
                  );
                })}
              </div>
            );
          })}
    </div>
  );
}

/** Groups flat items by category preserving first-seen order. */
export function groupCommandResults<T>(
  items: readonly T[],
  getCategory: (item: T) => string,
): CommandResultsSection<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const category = getCategory(item);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(item);
  }
  return Array.from(groups.entries()).map(([category, groupItems]) => ({
    category,
    items: groupItems,
  }));
}
