/**
 * Shared keyboard guards.
 *
 * Window-level shortcut handlers must not steal keys from text fields or fire
 * underneath an open modal/drawer. These two checks are the same everywhere, so
 * they live here instead of being re-implemented per hook.
 */

/** True when the event originates from a control that owns text input. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
}

/** True while a modal, drawer, or command palette owns the screen. */
export function isOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.querySelector("[role='dialog'],[data-modal-open='true'],[aria-modal='true']") !== null
  );
}

/**
 * True while a confirmation dialog is asking the user to decide.
 *
 * A save/send shortcut registered on `window` must not fire *through* that
 * confirmation — the user is answering "discard or keep", not "submit". Radix
 * renders `AlertDialogContent` with `role='alertdialog'`, so this is narrower
 * than {@link isOverlayOpen} and safe to use inside a dialog-based form.
 */
export function isConfirmDialogOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector("[role='alertdialog']") !== null;
}
