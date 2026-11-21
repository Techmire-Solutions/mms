import { useCallback } from "react";

/** Pixels a mouse must travel before a press becomes a drag (keeps clicks working). */
const DRAG_THRESHOLD_PX = 5;

function overflowsInline(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1;
}

function overflowsBlock(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1;
}

/**
 * Mouse drag-to-scroll plus vertical-wheel → horizontal scroll for overflowing
 * horizontal strips (tab bars, chip rows). Touch and pen keep native scrolling.
 * A drag swallows the trailing click so a tab is not activated by accident.
 * Only acts while the element actually overflows sideways; vertical strips
 * (e.g. FormModal tabs at desktop width) are left untouched.
 *
 * Returns a callback ref (React 19 ref cleanup) — attach it to the scroller.
 */
export function useDragScroll<T extends HTMLElement>(): (node: T | null) => (() => void) | void {
  return useCallback((el: T | null) => {
    if (!el) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;

    const suppressClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const endDrag = () => {
      if (dragging) {
        // One-shot capture listener eats the click the browser fires after pointerup.
        el.addEventListener("click", suppressClick, { capture: true, once: true });
        // If no click follows (pointer released outside), drop the listener next task.
        setTimeout(() => el.removeEventListener("click", suppressClick, { capture: true }), 0);
        el.style.removeProperty("cursor");
        el.style.removeProperty("user-select");
        el.style.removeProperty("scroll-behavior");
      }
      if (pointerId !== null && el.hasPointerCapture?.(pointerId)) {
        el.releasePointerCapture(pointerId);
      }
      pointerId = null;
      dragging = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if (!overflowsInline(el)) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = el.scrollLeft;
      dragging = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId === null || event.pointerType !== "mouse") return;
      const dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        el.setPointerCapture?.(pointerId);
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
        // Follow the pointer 1:1; a smooth scroll-behavior would lag behind it.
        el.style.scrollBehavior = "auto";
      }
      // Same formula in LTR and RTL: dragging right reveals content on the left.
      el.scrollLeft = startScroll - dx;
      event.preventDefault();
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      if (!overflowsInline(el) || overflowsBlock(el)) return;
      const rtl = getComputedStyle(el).direction === "rtl";
      el.scrollBy({ left: rtl ? -event.deltaY : event.deltaY });
      event.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("click", suppressClick, { capture: true });
    };
  }, []);
}
