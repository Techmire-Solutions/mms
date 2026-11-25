import React, { useRef, useMemo, type ReactNode } from "react";
import { m } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useReducedMotion } from "../tenant/index.js";
import { useTranslation } from "../i18n/index.js";
import { DirectoryCardsSelectAllBar } from "@mms/ui/app/DirectoryCardsSelectAllBar";
import { useMediaQuery } from "../tenant/index.js";
import { MEDIA_SM_UP } from "../tenant/index.js";
import { containerVariants } from "@mms/ui/app/motionVariants";
import { cn } from "@mms/ui";

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
  renderItem?: (item: T, index: number) => ReactNode;
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
 * responsive single/pair-item virtualization on mobile, and select-all bar integration.
 */
export function ModuleDirectoryCards<T = unknown>({
  children,
  className,
  cols = 2,
  items,
  renderItem,
  selectedIds,
  onSelectAll,
  allSelected = false,
  someSelected = false,
  selectAllLabel,
  deselectAllLabel,
  selectedCountLabel,
  pageCountLabel,
  checkboxIdPrefix = "entity-cards",
}: EntityCardsGridProps<T>): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const isSmUp = useMediaQuery(MEDIA_SM_UP);
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement | null>(null);

  const isParameterized = items !== undefined && renderItem !== undefined;
  // Virtualize when items exceed 30 (or custom threshold) to match test contract and preserve performance
  const isVirtualized = isParameterized && items.length > 30;

  // Below sm (640px), grid is single-column, so group size is 1 item per row.
  // At sm+, group size matches the 2-column layout.
  const groupSize = isSmUp ? 2 : 1;

  const itemGroups = useMemo(() => {
    if (!isVirtualized || !items) return [];
    const groups: T[][] = [];
    for (let i = 0; i < items.length; i += groupSize) {
      groups.push(items.slice(i, i + groupSize));
    }
    return groups;
  }, [items, isVirtualized, groupSize]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is not React-Compiler-compatible (upstream); this component intentionally stays uncompiled.
  const rowVirtualizer = useVirtualizer({
    count: itemGroups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (groupSize === 1 ? 220 : 180),
    overscan: 4,
    enabled: isVirtualized,
  });

  if (!isParameterized) {
    return (
      <m.div
        variants={reducedMotion ? undefined : containerVariants}
        initial={reducedMotion ? false : "hidden"}
        animate={reducedMotion ? undefined : "visible"}
        className={cn("grid gap-4", COLS_MAP[cols], className)}
      >
        {children}
      </m.div>
    );
  }

  return (
    <>
      {onSelectAll && items.length > 0 ? (
        <DirectoryCardsSelectAllBar
          checkboxId={`${checkboxIdPrefix}-select-all`}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={onSelectAll}
          selectLabel={selectAllLabel ?? t("common.selectAll")}
          deselectLabel={deselectAllLabel ?? t("common.deselect")}
          selectedCount={selectedIds?.length ?? 0}
          selectedCountLabel={
            selectedCountLabel ?? t("common.selectedCount", { count: selectedIds?.length ?? 0 })
          }
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
              const group = itemGroups[virtualRow.index];
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
                    {group.map((item, i) => renderItem(item, virtualRow.index * groupSize + i))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={cn("grid gap-4", COLS_MAP[cols], className)}>
          {items.map((item, index) => renderItem(item, index))}
        </div>
      )}
    </>
  );
}
