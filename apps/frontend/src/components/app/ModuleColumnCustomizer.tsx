import React from "react";
import { Columns3, Search, RotateCcw, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ModuleColumnCustomizerList } from "@/components/app/ModuleColumnCustomizerList";
import { WORK_TOOLBAR_TRIGGER, WORK_TOOLBAR_TRIGGER_IDLE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import type {
  ModuleColumnCustomizerLabels,
  ModuleColumnCustomizerProps,
} from "@/components/app/moduleColumnCustomizerTypes";
import { useModuleColumnCustomizerModel } from "./useModuleColumnCustomizerModel";

export type { ModuleColumnCustomizerLabels, ModuleColumnCustomizerProps };

/** Per-user Work directory column layout picker (globle1 §3.4). */
export const ModuleColumnCustomizer = function ModuleColumnCustomizer({
  columnRegistry,
  entityType,
  descriptor,
  updateUserColumnLayout,
  onResetLayout,
  labels,
  className,
  disabled = false,
}: ModuleColumnCustomizerProps): React.JSX.Element {
  const model = useModuleColumnCustomizerModel({
    columnRegistry,
    entityType,
    descriptor,
    updateUserColumnLayout,
    labels,
  });

  const {
    t,
    registry,
    resolvedLabels,
    searchQuery,
    setSearchQuery,
    visibleColumns,
    hiddenColumns,
    hiddenCount,
    hasNonFixedHidden,
    hasNonFixedVisible,
    dragging,
    dragOver,
    toggle,
    showAll,
    hideAll,
    handleDragStart,
    handleDragOver,
    handleDrop,
    clearDrag,
    moveColumn,
  } = model;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(WORK_TOOLBAR_TRIGGER, WORK_TOOLBAR_TRIGGER_IDLE, className)}
        >
          <Columns3 className="w-3.5 h-3.5" aria-hidden="true" />
          {/* WCAG 2.5.3 label-in-name: accessible name must contain the full
              visible label, so it is derived from content (label + count badge)
              and never overridden with aria-label. */}
          <span>{resolvedLabels.trigger}</span>
          {hiddenCount > 0 && (
            <span className="ms-0.5 px-1.5 py-0.2 rounded-full text-2xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {registry.length - hiddenCount}/{registry.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-76 p-3 space-y-3 rounded-xl shadow-lg border border-border/80"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h4 className="min-w-0 text-xs font-bold text-foreground uppercase tracking-wide">
              {resolvedLabels.title}
            </h4>
            <span className="text-3xs text-foreground/75 font-medium">
              (
              {resolvedLabels.visibleCount
                ? resolvedLabels.visibleCount(registry.length - hiddenCount, registry.length)
                : `${registry.length - hiddenCount}/${registry.length}`}
              )
            </span>
          </div>
          {onResetLayout && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetLayout}
              className="px-2 text-3xs text-foreground/80 hover:text-foreground hover:bg-muted flex items-center gap-1 cursor-pointer"
              title={resolvedLabels.reset}
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>{resolvedLabels.reset}</span>
            </Button>
          )}
        </div>

        {registry.length > 5 && (
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={resolvedLabels.searchPlaceholder}
              aria-label={resolvedLabels.searchPlaceholder}
              className="h-8 ps-8 pe-7 text-xs bg-muted/30 border-border/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                aria-label={t("common.clearSearch")}
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <ModuleColumnCustomizerList
          visibleColumns={visibleColumns}
          hiddenColumns={hiddenColumns}
          dragging={dragging}
          dragOver={dragOver}
          labels={resolvedLabels}
          toggle={toggle}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          clearDrag={clearDrag}
          onMoveColumn={moveColumn}
          showAll={showAll}
          hideAll={hideAll}
          hasNonFixedHidden={hasNonFixedHidden}
          hasNonFixedVisible={hasNonFixedVisible}
          isSearching={Boolean(searchQuery)}
        />
      </PopoverContent>
    </Popover>
  );
};
