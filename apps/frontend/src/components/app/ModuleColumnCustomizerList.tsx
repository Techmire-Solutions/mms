import React from "react";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import type { ModuleColumnCustomizerListProps } from "@/components/ui/moduleColumnCustomizerTypes";
import { cn } from "@/lib/utils";

export type { ModuleColumnCustomizerListProps };

export const ModuleColumnCustomizerList = function ModuleColumnCustomizerList({
  visibleColumns,
  hiddenColumns,
  dragging,
  dragOver,
  labels,
  toggle,
  handleDragStart,
  handleDragOver,
  handleDrop,
  clearDrag,
  onMoveColumn,
  showAll,
  hideAll,
  hasNonFixedHidden = false,
  hasNonFixedVisible = false,
  isSearching = false,
}: ModuleColumnCustomizerListProps): React.JSX.Element {
  const totalCount = visibleColumns.length + hiddenColumns.length;

  if (isSearching && totalCount === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        {labels.noMatches || "No columns match"}
      </div>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto pe-1 space-y-3">
      {!isSearching && (showAll || hideAll) && (hasNonFixedHidden || hasNonFixedVisible) && (
        <div className="flex items-center justify-between gap-1 pb-1 border-b border-border/40 text-3xs">
          {showAll && hasNonFixedHidden ? (
            <button
              type="button"
              onClick={showAll}
              className="text-3xs font-semibold text-foreground hover:text-primary underline-offset-2 hover:underline transition-colors cursor-pointer"
            >
              {labels.showAll || "Show all"}
            </button>
          ) : (
            <span />
          )}
          {hideAll && hasNonFixedVisible && (
            <button
              type="button"
              onClick={hideAll}
              className="text-3xs font-medium text-foreground/75 hover:text-foreground transition-colors cursor-pointer"
            >
              {labels.hideAll || "Hide all"}
            </button>
          )}
        </div>
      )}

      {visibleColumns.length > 0 && (
        <div className="space-y-1">
          <span className="text-3xs font-bold text-foreground/75 uppercase tracking-wider block">
            {labels.visibleAndOrder}
          </span>
          {visibleColumns.map((col) => (
            <div
              key={col.key}
              tabIndex={col.fixed ? undefined : 0}
              draggable={!col.fixed}
              aria-description={
                col.fixed ? undefined : "Press Alt+ArrowUp or Alt+ArrowDown to reorder"
              }
              onDragStart={(event) => !col.fixed && handleDragStart(event, col.key)}
              onDragOver={(event) => handleDragOver(event, col.key)}
              onDrop={(event) => handleDrop(event, col.key)}
              onDragEnd={clearDrag}
              onKeyDown={(event) => {
                if (col.fixed) return;
                if (
                  (event.key === "ArrowUp" || event.key === "Up") &&
                  (event.altKey || event.metaKey)
                ) {
                  event.preventDefault();
                  onMoveColumn?.(col.key, "up");
                } else if (
                  (event.key === "ArrowDown" || event.key === "Down") &&
                  (event.altKey || event.metaKey)
                ) {
                  event.preventDefault();
                  onMoveColumn?.(col.key, "down");
                }
              }}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all select-none border-transparent hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                dragging === col.key && "opacity-40",
                dragOver === col.key && "border-primary bg-primary/5",
              )}
            >
              <GripVertical
                className={cn(
                  "w-3.5 h-3.5 flex-shrink-0",
                  col.fixed
                    ? "opacity-20"
                    : "text-muted-foreground cursor-grab active:cursor-grabbing",
                )}
                aria-hidden="true"
              />
              <span className="flex-1 text-xs font-medium text-foreground text-start truncate">
                {col.label}
              </span>
              {col.fixed ? (
                <span className="text-2xs uppercase font-bold text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded tracking-wider">
                  {labels.fixed}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(col.key);
                  }}
                  className="min-w-8 min-h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md cursor-pointer"
                  aria-label={labels.hideColumn(col.label)}
                  title={labels.hideColumn(col.label)}
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {hiddenColumns.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border/50">
          <span className="text-3xs font-bold text-foreground/75 uppercase tracking-wider block">
            {labels.hidden}
          </span>
          {hiddenColumns.map((col) => (
            <button
              type="button"
              key={col.key}
              onClick={(e) => {
                e.stopPropagation();
                toggle(col.key);
              }}
              aria-label={labels.showColumn ? labels.showColumn(col.label) : undefined}
              title={labels.showColumn ? labels.showColumn(col.label) : undefined}
              className="flex items-center justify-between w-full px-2.5 min-h-8 rounded-lg border border-transparent hover:bg-muted/60 transition-colors text-start group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <EyeOff
                  className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0"
                  aria-hidden="true"
                />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">
                  {col.label}
                </span>
              </div>
              <Eye
                className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
