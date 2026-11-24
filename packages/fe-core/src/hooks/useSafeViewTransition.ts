import { useCallback } from "react";

/**
 * Modern Web Guidance: same-document-transitions & faster-spa-view-transitions
 * Safely wraps state changes or client navigation in `document.startViewTransition()`.
 * Degrades gracefully by executing `updateFn` directly in browsers without View Transitions
 * or when the user has enabled `prefers-reduced-motion: reduce`.
 */
export function useSafeViewTransition(): (updateFn: () => void | Promise<void>) => void {
  return useCallback((updateFn: () => void | Promise<void>) => {
    if (typeof document === "undefined") {
      void updateFn();
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

    const doc = document as unknown as {
      startViewTransition?: (fn: () => void | Promise<void>) => void;
    };

    if (typeof doc.startViewTransition === "function" && !prefersReducedMotion) {
      doc.startViewTransition(updateFn);
    } else {
      void updateFn();
    }
  }, []);
}
