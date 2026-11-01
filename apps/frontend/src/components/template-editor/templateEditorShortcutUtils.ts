/**
 * Helper utilities for keyboard shortcut detection and direction handling.
 */

/**
 * True when the event originated inside the editor instance identified by `editorId`
 * (or when no id was supplied, e.g. a hook used in isolation by a test).
 *
 * The editor mounts real `<button>` elements, so "not an input" was not a strong
 * enough scope: a Delete press on a toolbar/header button used to delete the selected
 * canvas element, and Space used to block page scrolling from anywhere on the page.
 */
export function isEventInsideEditor(event: Event, editorId?: string): boolean {
  if (!editorId) return true;
  const target = event.target as HTMLElement | null;
  const root = target?.closest?.("[data-template-editor-root]") as HTMLElement | null;
  return root?.dataset.templateEditorRoot === editorId;
}

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
