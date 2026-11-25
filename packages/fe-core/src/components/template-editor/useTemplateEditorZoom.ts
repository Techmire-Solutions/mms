/**
 * @file useTemplateEditorZoom.ts
 * @description Hook managing canvas scaling, auto-fit, pinch-to-zoom / Ctrl+wheel zooming, and reset.
 */

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { PageSizeInfo } from "@mms/contracts";

export interface UseTemplateEditorZoomOptions {
  size: PageSizeInfo;
}

/** Manual zoom bounds (button/keyboard zoom). */
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
/** Auto-fit bounds — fitting is allowed to enlarge a small receipt, but not wildly. */
const MIN_FIT = 0.3;
const MAX_FIT = 1.5;
/** Horizontal + vertical chrome inside the scroll region (padding + status pill). */
const VIEWPORT_PADDING_X = 32;
const VIEWPORT_PADDING_Y = 88;

/** Marks the scaled page wrapper so zoom can keep the cursor anchored. */
export const TEMPLATE_PAGE_WRAPPER_ATTR = "data-template-page-wrapper";

export function useTemplateEditorZoom({ size }: UseTemplateEditorZoomOptions) {
  const [autoScale, setAutoScale] = useState(1);
  const [customZoom, setCustomZoom] = useState<number | null>(null);
  const canvasViewportRef = useRef<HTMLElement>(null);
  /** Page-space point that must stay under the cursor across a zoom change. */
  const anchorRef = useRef<{
    pageX: number;
    pageY: number;
    cursorX: number;
    cursorY: number;
  } | null>(null);

  // Derived during render (no render-time ref sync): callbacks depend on
  // `canvasScale` directly and the wheel handler reads it via useEffectEvent.
  const canvasScale = customZoom ?? autoScale;

  const clampManual = (value: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));

  const zoomIn = useCallback(
    () => setCustomZoom((prev) => clampManual((prev ?? canvasScale) + 0.1)),
    [canvasScale],
  );

  const zoomOut = useCallback(
    () => setCustomZoom((prev) => clampManual((prev ?? canvasScale) - 0.1)),
    [canvasScale],
  );

  const zoomReset = useCallback(() => setCustomZoom(1), []);
  const zoomFit = useCallback(() => setCustomZoom(null), []);

  /**
   * Auto-scale on viewport resize — fits BOTH axes.
   *
   * The previous version only considered width and clamped to `min(1, …)`, so on a
   * large screen an A6 receipt stayed at 100% in a sea of empty canvas and "Fit" could
   * only ever shrink. Fitting the height too means the page actually fills the space.
   */
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const updateCanvasScale = () => {
      const availableWidth = Math.max(0, viewport.clientWidth - VIEWPORT_PADDING_X);
      const availableHeight = Math.max(0, viewport.clientHeight - VIEWPORT_PADDING_Y);
      if (availableWidth <= 0) return;
      const widthFit = availableWidth / size.width;
      const heightFit = availableHeight > 0 ? availableHeight / size.height : MAX_FIT;
      const fitted = Math.min(widthFit, heightFit, MAX_FIT);
      setAutoScale(Math.max(MIN_FIT, Number(fitted.toFixed(3))));
    };
    const observer = new ResizeObserver(updateCanvasScale);
    observer.observe(viewport);
    updateCanvasScale();
    return () => observer.disconnect();
  }, [size.width, size.height]);

  /**
   * Ctrl/Cmd + wheel zoom, anchored at the cursor.
   *
   * The anchor is applied in a layout effect after the new scale is painted, otherwise
   * the point under the cursor drifts and zooming feels like it fights the user.
   */
  const handleWheel = useEffectEvent((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const wrapper = viewport.querySelector<HTMLElement>(`[${TEMPLATE_PAGE_WRAPPER_ATTR}]`);
    if (wrapper) {
      const viewportRect = viewport.getBoundingClientRect();
      const cursorX = e.clientX - viewportRect.left;
      const cursorY = e.clientY - viewportRect.top;
      const originX = wrapper.offsetLeft;
      const originY = wrapper.offsetTop;
      anchorRef.current = {
        pageX: (viewport.scrollLeft + cursorX - originX) / canvasScale,
        pageY: (viewport.scrollTop + cursorY - originY) / canvasScale,
        cursorX,
        cursorY,
      };
    }
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setCustomZoom((prev) => clampManual((prev ?? canvasScale) + delta));
  });

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
    // Effect events are stable and exempt from the dependency list.
  }, []);

  // Pre-paint scroll anchoring: applying the anchor in a plain effect would flash
  // the pre-zoom position for a frame, so this deliberately stays a layout effect.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const viewport = canvasViewportRef.current;
    if (!anchor || !viewport) return;
    anchorRef.current = null;
    const wrapper = viewport.querySelector<HTMLElement>(`[${TEMPLATE_PAGE_WRAPPER_ATTR}]`);
    if (!wrapper) return;
    const originX = wrapper.offsetLeft;
    const originY = wrapper.offsetTop;
    viewport.scrollLeft = originX + anchor.pageX * canvasScale - anchor.cursorX;
    viewport.scrollTop = originY + anchor.pageY * canvasScale - anchor.cursorY;
  }, [canvasScale]);

  return {
    canvasScale,
    customZoom,
    autoScale,
    canvasViewportRef,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomFit,
  };
}
