import React, { useEffect, useRef, useState } from "react";
import { cn } from "@mms/ui";
import { useTranslation } from "../i18n";
import { clampModuleColumnWidth } from "@mms/contracts";
import { measureColumnAutoFitWidth } from "@mms/ui/app/measureColumnAutoFitWidth";
import {
  getTableCellWrapClass,
  getTableHeadAlignClass,
  type TableCellAlign,
  type TableCellVariant,
} from "@mms/ui";

export interface ResizableTableHeadProps extends Omit<
  React.ThHTMLAttributes<HTMLTableCellElement>,
  "children" | "align"
> {
  columnKey: string;
  width?: number;
  onResize?: (columnKey: string, width: number) => void;
  /** SR announcement on resize completion (columnKey, resolved width in px). */
  onResizeAnnounce?: (columnKey: string, width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  noWrap?: boolean;
  truncate?: boolean;
  align?: TableCellAlign;
  variant?: TableCellVariant;
  children: React.ReactNode;
}

/**
 * Work-directory table header with an end-edge drag handle to persist column width.
 */
export function ResizableTableHead({
  columnKey,
  width,
  onResize,
  onResizeAnnounce,
  minWidth = 80,
  maxWidth = 640,
  noWrap,
  truncate,
  align,
  variant,
  children,
  className,
  style,
  ...props
}: ResizableTableHeadProps): React.JSX.Element {
  const { t, isRtl } = useTranslation();
  const thRef = useRef<HTMLTableCellElement>(null);
  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const resizingRef = useRef(false);
  const cleanupResizeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupResizeRef.current) {
        cleanupResizeRef.current();
        cleanupResizeRef.current = null;
      }
    };
  }, []);

  const resolvedWidth = draftWidth ?? (typeof width === "number" && width > 0 ? width : undefined);

  const handlePointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!onResize) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = resolvedWidth ?? thRef.current?.getBoundingClientRect().width ?? minWidth;
    resizingRef.current = true;
    setDraftWidth(startWidth);

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!resizingRef.current) return;
      const rawDelta = moveEvent.clientX - startX;
      const delta = isRtl ? -rawDelta : rawDelta;
      const nextWidth = clampModuleColumnWidth(
        Math.min(maxWidth, Math.max(minWidth, startWidth + delta)),
      );
      setDraftWidth(nextWidth);
    };

    const cleanup = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      cleanupResizeRef.current = null;
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      cleanup();
      const rawDelta = upEvent.clientX - startX;
      const delta = isRtl ? -rawDelta : rawDelta;
      const nextWidth = clampModuleColumnWidth(
        Math.min(maxWidth, Math.max(minWidth, startWidth + delta)),
      );
      setDraftWidth(null);
      onResize(columnKey, nextWidth);
      onResizeAnnounce?.(columnKey, nextWidth);
    };

    cleanupResizeRef.current = cleanup;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (!onResize || !thRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const optimalWidth = measureColumnAutoFitWidth(thRef.current, minWidth, maxWidth);
    setDraftWidth(null);
    onResize(columnKey, optimalWidth);
    onResizeAnnounce?.(columnKey, optimalWidth);
  };

  // Keyboard alternative for column resize (WCAG 2.2 2.1.1 / 2.5.7): the handle is
  // a focusable separator; Arrow keys nudge the width, Shift amplifies the step,
  // and Home/End jump to the min/max. Direction mirrors the RTL layout.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (!onResize) return;
    const currentWidth =
      typeof resolvedWidth === "number"
        ? resolvedWidth
        : (thRef.current?.getBoundingClientRect().width ?? minWidth);
    const step = event.shiftKey ? 32 : 8;
    let nextWidth: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        nextWidth = isRtl ? currentWidth + step : currentWidth - step;
        break;
      case "ArrowRight":
        nextWidth = isRtl ? currentWidth - step : currentWidth + step;
        break;
      case "Home":
        nextWidth = minWidth;
        break;
      case "End":
        nextWidth = maxWidth;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const clampedWidth = clampModuleColumnWidth(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
    onResize(columnKey, clampedWidth);
    onResizeAnnounce?.(columnKey, clampedWidth);
  };

  return (
    <th
      ref={thRef}
      scope="col"
      role="columnheader"
      className={cn(
        "relative",
        getTableHeadAlignClass(align, variant),
        getTableCellWrapClass(noWrap, truncate),
        className,
      )}
      style={{
        ...style,
        ...(typeof resolvedWidth === "number"
          ? { width: resolvedWidth, minWidth: resolvedWidth, maxWidth: resolvedWidth }
          : undefined),
      }}
      {...props}
    >
      {children}
      {onResize ? (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={t("table.resizeColumn")}
          title={t("table.resizeColumn")}
          tabIndex={0}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          aria-valuenow={Math.round(resolvedWidth ?? minWidth)}
          onPointerDown={handlePointerDown}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={handleDoubleClick}
          onKeyDown={handleKeyDown}
          className="absolute inset-y-0 end-0 z-elevated flex w-11 min-w-11 cursor-col-resize select-none items-stretch justify-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-sm after:absolute after:inset-y-1 after:end-0 after:w-px after:bg-border/70 hover:after:bg-primary/60"
        />
      ) : null}
    </th>
  );
}
