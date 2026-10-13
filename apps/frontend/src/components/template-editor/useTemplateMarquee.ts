/**
 * @file useTemplateMarquee.ts
 * @description Rubber-band (marquee) selection for the canvas viewport.
 */

import React, { useEffectEvent } from "react";
import type { PageSizeInfo } from "@mms/shared";
import { boxesIntersect } from "./templateEditorUtils";

export interface MarqueeBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface UseTemplateMarqueeOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  canvasScale: number;
  size: PageSizeInfo;
  elements: { id: string; x: number; y: number; w: number; h: number }[];
  selectedIds: string[];
  isPreviewMode: boolean;
  isSpacePressed: boolean;
  onDeselect: () => void;
  onSelectElements?: (elementIds: string[]) => void;
}

export interface UseTemplateMarqueeReturn {
  marquee: MarqueeBox | null;
  onPointerDownBackground: (event: React.PointerEvent | React.MouseEvent) => void;
  onMouseDownBackground: (event: React.MouseEvent) => void;
}

/** A drag shorter than this is a click (i.e. "deselect"), not a marquee. */
const MARQUEE_THRESHOLD_PX = 4;

/**
 * Extracted from the canvas component: the marquee is a self-contained pointer
 * interaction (start on background, track on window, commit on pointer up) and had grown
 * the canvas file past the repository's 300-line ceiling on its own.
 */
export function useTemplateMarquee({
  canvasRef,
  canvasScale,
  size,
  elements,
  selectedIds,
  isPreviewMode,
  isSpacePressed,
  onDeselect,
  onSelectElements,
}: UseTemplateMarqueeOptions): UseTemplateMarqueeReturn {
  const [marquee, setMarquee] = React.useState<MarqueeBox | null>(null);
  const marqueeMovedRef = React.useRef(false);
  const isShiftRef = React.useRef(false);
  const marqueeRef = React.useRef(marquee);
  React.useEffect(() => {
    marqueeRef.current = marquee;
  }, [marquee]);

  const onPointerDownBackground = (event: React.PointerEvent | React.MouseEvent) => {
    if (event.button !== 0 || isPreviewMode || isSpacePressed) return;
    if (!canvasRef.current) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      target !== canvasRef.current &&
      target.closest("[role='button'], [data-resize-handle], .group")
    ) {
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = (event.clientX - rect.left) / canvasScale;
    const startY = (event.clientY - rect.top) / canvasScale;
    marqueeMovedRef.current = false;
    isShiftRef.current = event.shiftKey || event.metaKey || event.ctrlKey;
    setMarquee({ startX, startY, currentX: startX, currentY: startY });
  };

  const handleMarqueeMove = useEffectEvent((event: PointerEvent) => {
    const current = marqueeRef.current;
    if (!current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(size.width, (event.clientX - rect.left) / canvasScale));
    const currentY = Math.max(0, Math.min(size.height, (event.clientY - rect.top) / canvasScale));
    if (
      Math.abs(currentX - current.startX) > MARQUEE_THRESHOLD_PX ||
      Math.abs(currentY - current.startY) > MARQUEE_THRESHOLD_PX
    ) {
      marqueeMovedRef.current = true;
    }
    setMarquee((prev) => (prev ? { ...prev, currentX, currentY } : null));
  });

  const handleMarqueeUp = useEffectEvent(() => {
    const current = marqueeRef.current;
    if (current && marqueeMovedRef.current) {
      const box = {
        x: Math.min(current.startX, current.currentX),
        y: Math.min(current.startY, current.currentY),
        w: Math.abs(current.currentX - current.startX),
        h: Math.abs(current.currentY - current.startY),
      };
      const hitIds = elements
        .filter((el) => boxesIntersect(box, { x: el.x, y: el.y, w: el.w, h: el.h }))
        .map((el) => el.id);

      if (onSelectElements) {
        onSelectElements(
          isShiftRef.current ? Array.from(new Set([...selectedIds, ...hitIds])) : hitIds,
        );
      }
    } else if (current) {
      onDeselect();
    }
    setMarquee(null);
  });

  React.useEffect(() => {
    if (!marquee) return;
    window.addEventListener("pointermove", handleMarqueeMove, { passive: true });
    window.addEventListener("pointerup", handleMarqueeUp);
    window.addEventListener("pointercancel", handleMarqueeUp);
    return () => {
      window.removeEventListener("pointermove", handleMarqueeMove);
      window.removeEventListener("pointerup", handleMarqueeUp);
      window.removeEventListener("pointercancel", handleMarqueeUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marquee != null]);

  return {
    marquee,
    onPointerDownBackground,
    onMouseDownBackground: onPointerDownBackground,
  };
}
