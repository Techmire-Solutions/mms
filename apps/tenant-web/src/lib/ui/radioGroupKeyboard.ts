import type React from "react";

/**
 * Keyboard support for rich radio-card groups (`role="radiogroup"` + `role="radio"` buttons):
 * Arrow keys move to the previous/next option and select it, Home/End jump to the ends.
 * The caller owns roving `tabIndex` (selected item 0, others -1).
 */
export function handleRadioGroupKeyDown<T>(
  event: React.KeyboardEvent<HTMLElement>,
  options: readonly T[],
  selected: T | undefined,
  onSelect: (option: T) => void,
): void {
  if (options.length === 0) return;
  const key = event.key;
  if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(key)) return;
  event.preventDefault();
  const currentIndex = selected ? options.indexOf(selected) : -1;
  let nextIndex = currentIndex;
  if (key === "Home") nextIndex = 0;
  else if (key === "End") nextIndex = options.length - 1;
  else if (key === "ArrowDown" || key === "ArrowRight") {
    nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % options.length;
  } else {
    nextIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
  }
  const next = options[nextIndex];
  if (!next) return;
  onSelect(next);
  event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex]?.focus();
}
