/**
 * Helper utilities for keyboard shortcut detection and direction handling.
 */

export function isInputElementFocused(target: HTMLElement | null): boolean {
  return Boolean(
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      target.tagName === "SELECT"),
  );
}

export function handleResizeShortcut(
  e: KeyboardEvent,
  resizeSelected: (dw: number, dh: number) => void,
): boolean {
  if (!e.altKey) return false;
  const step = e.shiftKey ? 8 : 1;
  if (e.key === "ArrowRight") {
    e.preventDefault();
    resizeSelected(step, 0);
    return true;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    resizeSelected(-step, 0);
    return true;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    resizeSelected(0, step);
    return true;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    resizeSelected(0, -step);
    return true;
  }
  return false;
}

export function handleNudgeShortcut(
  e: KeyboardEvent,
  nudgeSelected: (dx: number, dy: number) => void,
): boolean {
  const step = e.shiftKey ? 8 : 1;
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    nudgeSelected(-step, 0);
    return true;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    nudgeSelected(step, 0);
    return true;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    nudgeSelected(0, -step);
    return true;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    nudgeSelected(0, step);
    return true;
  }
  return false;
}
