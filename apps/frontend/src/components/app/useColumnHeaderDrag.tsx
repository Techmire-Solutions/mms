import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type DropPosition = "before" | "after";

export interface UseColumnHeaderDragOptions {
  columns?: Array<{ id: string; label: string }>;
  /** Columns that cannot be dragged/reordered (pinned). */
  pinnedColumnIds?: ReadonlySet<string>;
  onReorder?: (sourceId: string, targetId: string, position: DropPosition) => void;
  isColumnDraggable?: (columnId: string) => boolean;
}

interface PointerDragState {
  startX: number;
  startY: number;
  colId: string;
  colLabel: string;
  isDragging: boolean;
}

const ACTIVATION_DISTANCE = 5;

export function useColumnHeaderDrag({
  columns: _columns,
  pinnedColumnIds,
  onReorder,
  isColumnDraggable,
}: UseColumnHeaderDragOptions) {
  const [dragState, setDragState] = useState<{
    draggedId: string | null;
    draggedLabel: string | null;
    targetId: string | null;
    dropPosition: DropPosition | null;
    pointerPos: { x: number; y: number } | null;
  }>({
    draggedId: null,
    draggedLabel: null,
    targetId: null,
    dropPosition: null,
    pointerPos: null,
  });

  const pointerStateRef = useRef<PointerDragState | null>(null);
  const suppressClickRef = useRef(false);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  // Latest drop target, updated on pointer move so the pointer-up handler can
  // fire `onReorder` outside the (pure) setState updater.
  const latestDropRef = useRef<{ targetId: string | null; dropPosition: DropPosition | null }>({
    targetId: null,
    dropPosition: null,
  });

  const canDrag = useCallback(
    (colId: string) => {
      if (!onReorder) return false;
      if (pinnedColumnIds?.has(colId)) return false;
      if (isColumnDraggable && !isColumnDraggable(colId)) return false;
      return true;
    },
    [onReorder, pinnedColumnIds, isColumnDraggable],
  );

  const cleanup = useCallback(() => {
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }
    pointerStateRef.current = null;
    latestDropRef.current = { targetId: null, dropPosition: null };
    setDragState({
      draggedId: null,
      draggedLabel: null,
      targetId: null,
      dropPosition: null,
      pointerPos: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current();
      }
    };
  }, []);

  const handlePointerDown = useCallback(
    (colId: string, colLabel: string, event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if (!canDrag(colId)) return;

      const target = event.target as HTMLElement;
      // Do not initiate drag if user clicked on a resize handle
      if (target.closest('[role="separator"]') || target.closest(".cursor-col-resize")) {
        return;
      }

      const startX = event.clientX;
      const startY = event.clientY;

      pointerStateRef.current = {
        startX,
        startY,
        colId,
        colLabel,
        isDragging: false,
      };
      latestDropRef.current = { targetId: null, dropPosition: null };

      const handlePointerMove = (e: PointerEvent) => {
        const state = pointerStateRef.current;
        if (!state) return;

        if (!state.isDragging) {
          const dist = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
          if (dist >= ACTIVATION_DISTANCE) {
            state.isDragging = true;
            document.body.style.userSelect = "none";
            document.body.style.cursor = "grabbing";
          } else {
            return;
          }
        }

        // Find hovered column header
        const elem = document.elementFromPoint(e.clientX, e.clientY);
        const th = elem?.closest("th[data-column-id]") as HTMLElement | null;
        let nextTargetId: string | null = null;
        let nextPos: DropPosition | null = null;

        if (th) {
          const thId = th.getAttribute("data-column-id");
          if (thId && thId !== state.colId && !pinnedColumnIds?.has(thId)) {
            nextTargetId = thId;
            const rect = th.getBoundingClientRect();
            nextPos = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
          }
        }

        latestDropRef.current = { targetId: nextTargetId, dropPosition: nextPos };
        setDragState({
          draggedId: state.colId,
          draggedLabel: state.colLabel,
          targetId: nextTargetId,
          dropPosition: nextPos,
          pointerPos: { x: e.clientX, y: e.clientY },
        });
      };

      const handlePointerUp = () => {
        const state = pointerStateRef.current;
        if (state?.isDragging) {
          suppressClickRef.current = true;
          setTimeout(() => {
            suppressClickRef.current = false;
          }, 120);

          // Fire the reorder as a side effect outside the setState updater so the
          // consumer's state updates never run during another component's render.
          const { targetId, dropPosition } = latestDropRef.current;
          if (targetId && dropPosition && onReorder) {
            onReorder(state.colId, targetId, dropPosition);
          }
        }

        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        cleanup();
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);

      cleanupListenersRef.current = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
    },
    [canDrag, pinnedColumnIds, onReorder, cleanup],
  );

  const getThDragProps = useCallback(
    (colId: string, colLabel: string) => {
      const isDraggable = canDrag(colId);
      const isBeingDragged = dragState.draggedId === colId;
      return {
        "data-column-id": colId,
        onPointerDown: isDraggable
          ? (e: React.PointerEvent<HTMLElement>) => handlePointerDown(colId, colLabel, e)
          : undefined,
        className: cn(
          isDraggable && "cursor-grab active:cursor-grabbing",
          isBeingDragged && "opacity-40",
        ),
      };
    },
    [canDrag, dragState.draggedId, handlePointerDown],
  );

  const renderDropIndicator = useCallback(
    (colId: string) => {
      if (dragState.targetId !== colId || !dragState.dropPosition) return null;
      return (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-1 w-1 bg-primary z-40 rounded-full shadow-[0_0_8px_hsl(var(--primary))]",
            dragState.dropPosition === "before" ? "start-0" : "end-0",
          )}
        />
      );
    },
    [dragState.targetId, dragState.dropPosition],
  );

  const renderDragOverlay = useCallback(() => {
    if (!dragState.draggedLabel || !dragState.pointerPos || typeof document === "undefined") {
      return null;
    }
    return createPortal(
      <div
        className="fixed pointer-events-none z-tooltip -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/95 border border-primary/60 shadow-xl text-xs font-semibold text-foreground backdrop-blur-xs ring-2 ring-primary/20 select-none"
        style={{
          left: `${dragState.pointerPos.x}px`,
          top: `${dragState.pointerPos.y}px`,
        }}
      >
        <GripVertical className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        <span>{dragState.draggedLabel}</span>
      </div>,
      document.body,
    );
  }, [dragState.draggedLabel, dragState.pointerPos]);

  return {
    canDrag,
    isDragging: Boolean(dragState.draggedId),
    draggedId: dragState.draggedId,
    targetId: dragState.targetId,
    dropPosition: dragState.dropPosition,
    suppressClickRef,
    getThDragProps,
    renderDropIndicator,
    renderDragOverlay,
  };
}
