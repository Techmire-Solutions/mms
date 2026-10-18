/**
 * Modern Web Guidance: break-up-long-tasks
 * Pauses long-running client operations (e.g., CSV imports, search indexing, PDF generation)
 * periodically to yield control back to the browser's main thread, keeping user interaction
 * and rendering responsive to protect Interaction to Next Paint (INP).
 *
 * Uses native `scheduler.yield()` where supported, falling back to `setTimeout(0)`.
 *
 * @param deadline - Timestamp (performance.now()) deadline. Yield occurs when now >= deadline.
 * @param budgetMs - Duration budget in milliseconds before yielding (default: 50ms).
 * @returns Updated next deadline timestamp.
 */
export async function yieldToMain(deadline: number, budgetMs: number = 50): Promise<number> {
  if (performance.now() >= deadline) {
    const scheduler =
      typeof window !== "undefined" && "scheduler" in window
        ? (window.scheduler as { yield?: () => Promise<void> } | undefined)
        : undefined;

    if (scheduler && typeof scheduler.yield === "function") {
      await scheduler.yield();
    } else {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return performance.now() + budgetMs;
  }
  return deadline;
}

export interface VisibilityInfo {
  initiallyBackgrounded: boolean;
  timeBackgrounded: number | null;
}

/**
 * Modern Web Guidance: detect-initial-visibility-state
 * Accurately determines whether the page was loaded in a background tab
 * and records the high-resolution timestamp when it occurred using VisibilityStateEntry.
 */
export function getVisibilityInfo(): VisibilityInfo {
  if (typeof performance !== "undefined" && typeof performance.getEntriesByType === "function") {
    const entries = performance.getEntriesByType("visibility-state");
    if (entries && entries.length > 0) {
      const first = entries[0];
      const initiallyBackgrounded = first.name === "hidden";
      let timeBackgrounded: number | null = null;
      for (const entry of entries) {
        if (entry.name === "hidden") {
          timeBackgrounded = entry.startTime;
          break;
        }
      }
      return { initiallyBackgrounded, timeBackgrounded };
    }
  }

  const isHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  return {
    initiallyBackgrounded: isHidden,
    timeBackgrounded: isHidden ? 0 : null,
  };
}
