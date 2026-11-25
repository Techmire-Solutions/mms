/**
 * Schedules a callback to run after the browser has completed first paint,
 * avoiding contention with critical rendering work.
 *
 * Uses requestAnimationFrame to ensure the next paint cycle has finished,
 * followed by requestIdleCallback (or a brief setTimeout fallback) so low-priority
 * initializations (e.g. Sentry error reporting, Service Worker registration,
 * background live WebSockets) yield to the critical rendering path.
 */
export function runAfterFirstPaint(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let cancelled = false;
  let rafId: number | null = null;
  let idleId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    cancelled = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (idleId !== null && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleId);
    }
    if (timeoutId !== null) clearTimeout(timeoutId);
  };

  const scheduleIdle = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(
        () => {
          if (!cancelled) callback();
        },
        { timeout: 2000 },
      );
    } else {
      timeoutId = setTimeout(() => {
        if (!cancelled) callback();
      }, 0);
    }
  };

  if (typeof window.requestAnimationFrame === "function") {
    rafId = window.requestAnimationFrame(() => {
      // Nested rAF gives the browser one full frame to paint before kicking off idle tasks
      rafId = window.requestAnimationFrame(scheduleIdle);
    });
  } else {
    scheduleIdle();
  }

  return cancel;
}
