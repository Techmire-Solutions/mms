import { useEffect, useEffectEvent, useState } from "react";
import { computeSmartGuides, snap, type SmartGuideLine } from "./templateEditorUtils";
import {
  type DragItem,
  type DragStateInfo,
  type ResizeHandle,
  type ResizeStateInfo,
  type UseTemplateEditorInteractionsOptions,
} from "./templateEditorInteractionTypes";
import { computeResizedElement } from "./templateEditorResizeCalculation";
import { useTemplateEditorPan } from "./useTemplateEditorPan";

export type { DragItem, DragStateInfo, ResizeHandle, ResizeStateInfo, UseTemplateEditorInteractionsOptions };

/** Pointer travel (screen px) before a press becomes a drag/resize; below it the press is a plain click. */
const DRAG_THRESHOLD_PX = 3;

function exceedsDragThreshold(state: { startX: number; startY: number; hasMoved?: boolean }, event: PointerEvent): boolean {
  return (
    state.hasMoved === true ||
    Math.abs(event.clientX - state.startX) >= DRAG_THRESHOLD_PX ||
    Math.abs(event.clientY - state.startY) >= DRAG_THRESHOLD_PX
  );
}

export function useTemplateEditorInteractions<TPayload = Record<string, unknown>>({
  canvasScale,
  size,
  templateElements,
  dragState,
  resizeState,
  canvasViewportRef,
  updateElements,
  setHistory,
  setFuture,
}: UseTemplateEditorInteractionsOptions<TPayload>) {
  const [activeGuides, setActiveGuides] = useState<SmartGuideLine[]>([]);
  const {
    isSpacePressed,
    isPanning,
    onPointerDownViewport,
    handlePanMove,
    handlePanEnd,
  } = useTemplateEditorPan(canvasViewportRef);

  const onPointerMove = useEffectEvent((event: PointerEvent) => {
    if (handlePanMove(event)) {
      return;
    }

    const currentDrag = dragState.current;
    if (currentDrag) {
      if (!exceedsDragThreshold(currentDrag, event)) return;
      currentDrag.hasMoved = true;
      const deltaX = (event.clientX - currentDrag.startX) / canvasScale;
      const deltaY = (event.clientY - currentDrag.startY) / canvasScale;
      const itemMap = new Map(currentDrag.items.map((item) => [item.id, item]));

      if (currentDrag.items.length === 1) {
        const singleItem = currentDrag.items[0]!;
        const currentEl = templateElements.find((el) => el.id === singleItem.id);
        if (currentEl) {
          const otherBoxes = templateElements
            .filter((el) => el.id !== singleItem.id)
            .map((el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }));
          const maxX = Math.max(0, size.width - currentEl.w);
          const maxY = Math.max(0, size.height - currentEl.h);
          const rawBox = {
            x: Math.min(maxX, Math.max(0, singleItem.origX + deltaX)),
            y: Math.min(maxY, Math.max(0, singleItem.origY + deltaY)),
            w: currentEl.w,
            h: currentEl.h,
          };
          const snapRes = computeSmartGuides(rawBox, otherBoxes, size.width, size.height);
          setActiveGuides(snapRes.guides);

          updateElements((els) =>
            els.map((el) => (el.id === singleItem.id ? { ...el, x: snapRes.x, y: snapRes.y } : el))
          );
          return;
        }
      }

      updateElements((els) =>
        els.map((templateElement) => {
          const orig = itemMap.get(templateElement.id);
          if (!orig) return templateElement;
          const maxX = Math.max(0, size.width - templateElement.w);
          const maxY = Math.max(0, size.height - templateElement.h);
          return {
            ...templateElement,
            x: snap(Math.min(maxX, Math.max(0, orig.origX + deltaX))),
            y: snap(Math.min(maxY, Math.max(0, orig.origY + deltaY))),
          };
        })
      );
      setActiveGuides([]);
    }

    const currentResize = resizeState.current;
    if (currentResize) {
      if (!exceedsDragThreshold(currentResize, event)) return;
      currentResize.hasMoved = true;
      const deltaX = (event.clientX - currentResize.startX) / canvasScale;
      const deltaY = (event.clientY - currentResize.startY) / canvasScale;

      updateElements((els) =>
        els.map((el) => computeResizedElement(el, currentResize, deltaX, deltaY, size, event.shiftKey))
      );
    }
  });

  const onPointerUp = useEffectEvent(() => {
    handlePanEnd();
    setActiveGuides([]);
    if (dragState.current?.hasMoved) {
      const initial = dragState.current.initialTemplate;
      setHistory((historyStack) => [...historyStack.slice(-30), initial]);
      setFuture([]);
    } else if (resizeState.current?.hasMoved) {
      const initial = resizeState.current.initialTemplate;
      setHistory((historyStack) => [...historyStack.slice(-30), initial]);
      setFuture([]);
    }
    dragState.current = null;
    resizeState.current = null;
  });

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return {
    isSpacePressed,
    isPanning,
    activeGuides,
    onPointerDownViewport,
  };
}
