/**
 * Keyboard target for the marks grid.
 *
 * The grid is virtualized: only the mounted rows exist in the DOM, so navigating with
 * `querySelectorAll` stops at the window edge. This pure resolver works over the whole filtered
 * roster; the table then scrolls the target into view before focusing it.
 */
export type MarksGridNavigationKey = "Tab" | "Enter" | "ArrowDown" | "ArrowUp" | "Home" | "End";

/**
 * @returns the index to focus, or `null` when the browser's default behaviour should run
 * (leaving the grid with Tab at an edge, or an ignored key).
 */
export function resolveMarksGridTarget(
  current: number,
  key: MarksGridNavigationKey,
  shiftKey: boolean,
  count: number,
): number | null {
  if (!Number.isInteger(current) || current < 0 || current >= count) return null;

  if (key === "Tab") {
    const next = shiftKey ? current - 1 : current + 1;
    return next >= 0 && next < count ? next : null;
  }
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowUp") return Math.max(0, current - 1);
  // Enter / ArrowDown move down the roster (visual order), stopping at the last row.
  return Math.min(count - 1, current + 1);
}
