import { useCallback, useEffect, useRef } from "react";

/**
 * Prints the dashboard after expanding the parts that are collapsed on screen,
 * then restores the previous on-screen state once the print dialog closes.
 *
 * `window.print()` is synchronous and captures the current layout, so expanding
 * state and printing in the same tick would still print the collapsed view. The
 * deferred print runs after React has committed the expanded panels
 * (2026-11-04 UI review: mobile printed 4 of N metrics and no secondary insights).
 * The `afterprint` listener keeps the expansion from leaking into the page state;
 * it is also torn down on unmount and before a second print, so a browser that
 * never fires `afterprint` cannot strand a stale listener. The deferred rAF is
 * likewise cancelled on unmount: leaving the page before the frame fires must
 * not open a print dialog for a page the user already navigated away from.
 */
export function useDashboardPrintSnapshot(expand: () => void, restore: () => void): () => void {
  const pendingCleanupRef = useRef<(() => void) | null>(null);
  const pendingRafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      pendingCleanupRef.current?.();
      pendingCleanupRef.current = null;
      // Navigating away before the deferred frame must not open a print dialog
      // for a page the user already left.
      if (pendingRafRef.current !== null) {
        window.cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
    },
    [],
  );

  return useCallback(() => {
    expand();
    const cleanup = (): void => {
      window.removeEventListener("afterprint", cleanup);
      if (pendingCleanupRef.current === cleanup) pendingCleanupRef.current = null;
      restore();
    };
    pendingCleanupRef.current?.();
    pendingCleanupRef.current = cleanup;
    window.addEventListener("afterprint", cleanup);
    pendingRafRef.current = requestAnimationFrame(() => {
      pendingRafRef.current = null;
      window.print();
    });
  }, [expand, restore]);
}
