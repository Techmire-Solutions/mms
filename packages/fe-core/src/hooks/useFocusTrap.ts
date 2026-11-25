import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS_QUERY = [
  "a[href]",
  "area[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable]",
  '[tabindex]:not([tabindex^="-"])',
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS_QUERY)).filter(
    (el) =>
      (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0) &&
      el.getAttribute("aria-hidden") !== "true",
  );
}

/**
 * Traps keyboard Tab focus inside a target HTML element, restoring focus
 * to the previously active element on unmount.
 *
 * @param active - Whether focus trapping is active.
 * @returns Ref object to be attached to the modal/overlay container.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
): React.RefObject<T | null> {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocusedElement = document.activeElement as HTMLElement | null;
    let frameId: number | null = null;

    if (previouslyFocusedElement && !container.contains(previouslyFocusedElement)) {
      previouslyFocusedElement.blur();
    }

    const elements = getFocusableElements(container);
    if (elements.length > 0) {
      elements[0]?.focus();
      frameId = requestAnimationFrame(() => {
        if (!container.contains(document.activeElement)) {
          elements[0]?.focus();
        }
      });
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Tab") return;

      const items = getFocusableElements(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          event.preventDefault();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      container.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === "function") {
        previouslyFocusedElement.focus();
      }
    };
  }, [active]);

  return containerRef;
}
