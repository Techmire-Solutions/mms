import { useEffect } from "react";

let lockCount = 0;
let previousOverflow = "";
let previousPaddingInlineEnd = "";

/**
 * Locks background (document body) scrolling while an overlay is mounted, so
 * scrolling inside a modal never chains to the page behind it.
 *
 * - Reference-counted: safe with nested/stacked overlays (only the last unlock restores).
 * - Compensates for the scrollbar width to avoid a layout shift when the bar disappears,
 *   leveraging modern CSS `scrollbar-gutter: stable` when supported.
 *
 * @param active - When false, the lock is not applied (e.g. an animated dialog that is closed).
 */
export function useBodyScrollLock(active: boolean = true): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const body = document.body;

    if (lockCount === 0) {
      previousOverflow = body.style.overflow;
      previousPaddingInlineEnd = body.style.paddingInlineEnd;
      body.style.overflow = "hidden";

      // Modern Web Guidance: prevent-layout-shifts-with-scrollbar-gutter
      // When CSS scrollbar-gutter: stable is supported, the gutter is reserved natively by CSS
      // without layout shift. Otherwise, fallback to measuring scrollbar width and offsetting padding.
      const hasNativeGutter =
        typeof CSS !== "undefined" && typeof CSS.supports === "function"
          ? CSS.supports("scrollbar-gutter", "stable")
          : false;

      if (!hasNativeGutter) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
          const current = parseFloat(getComputedStyle(body).paddingInlineEnd) || 0;
          body.style.paddingInlineEnd = `${current + scrollbarWidth}px`;
        }
      }
    }

    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        body.style.overflow = previousOverflow;
        body.style.paddingInlineEnd = previousPaddingInlineEnd;
      }
    };
  }, [active]);
}
