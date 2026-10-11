import React, { useRef, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { EntityCardsSelectAllBar } from "@/components/ui/EntityCardsSelectAllBar";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const COLS_MAP = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

export interface EntityCardsGridProps<T = unknown> {
  children?: ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4;
  // Parameterized list rendering
  items?: readonly T[];
  renderItem?: (item: T) => ReactNode;
  selectedIds?: readonly (string | number)[];
  onSelectAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
  selectAllLabel?: string;
  deselectAllLabel?: string;
  selectedCountLabel?: ReactNode;
  pageCountLabel?: ReactNode;
  checkboxIdPrefix?: string;
}

/**
 * Universal Directory Cards Grid primitive supporting responsive column counts,
 * optional large-dataset virtualization, and select-all bar integration.
 */
export function EntityCardsGrid<T = unknown>({
  children,
  className,
  cols = 2,
  items,
  renderItem,
  selectedIds,
  onSelectAll,
  allSelected = false,
  someSelected = false,
  selectAllLabel = "Select All",
  deselectAllLabel = "Deselect",
  selectedCountLabel,
  pageCountLabel,
  checkboxIdPrefix = "entity-cards",
}: EntityCardsGridProps<T>): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const parentRef = useRef<HTMLDivElement | null>(null);

  const isParameterized = items !== undefined && renderItem !== undefined;
  const isVirtualized = isParameterized && items.length > 30;

  const itemPairs = useMemo(() => {
    if (!isVirtualized || !items) return [];
    const pairs: T[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      pairs.push(items.slice(i, i + 2));
    }
    return pairs;
  }, [items, isVirtualized]);

  const rowVirtualizer = useVirtualizer({
    count: itemPairs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 6,
    enabled: isVirtualized,
  });

  if (!isParameterized) {
    return (
      <motion.div
        variants={reducedMotion ? undefined : containerVariants}
        initial={reducedMotion ? false : "hidden"}
        animate={reducedMotion ? undefined : "visible"}
        className={cn("grid gap-4", COLS_MAP[cols], className)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <>
      {onSelectAll && items.length > 0 ? (
        <EntityCardsSelectAllBar
          checkboxId={`${checkboxIdPrefix}-select-all`}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={onSelectAll}
          selectLabel={selectAllLabel}
          deselectLabel={deselectAllLabel}
          selectedCount={selectedIds?.length ?? 0}
          selectedCountLabel={selectedCountLabel || `${selectedIds?.length ?? 0} selected`}
          pageCountLabel={pageCountLabel}
        />
      ) : null}

      {isVirtualized ? (
        <div ref={parentRef} className="w-full max-h-drawer overflow-y-auto overflow-x-hidden pe-1">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const pair = itemPairs[virtualRow.index];
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
                  className="pb-4"
                >
                  <div className={cn("grid gap-4", COLS_MAP[cols], className)}>
                    {pair.map((item) => renderItem(item))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={cn("grid gap-4", COLS_MAP[cols], className)}>
          {items.map((item) => renderItem(item))}
        </div>
      )}
    </>
  );
}
