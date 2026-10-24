export interface ScrollAndFocusOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  fallbackSelector?: string;
}

/**
 * Focuses the first invalid form field and smoothly centers it in the scroll container.
 * Employs requestAnimationFrame to ensure pending DOM layout passes have flushed.
 *
 * @param candidateIds Array of potential element IDs or field names to try in priority order.
 * @param options Scroll options (behavior: 'smooth', block: 'center' by default) and fallback selector.
 * @returns boolean indicating whether an element was found or queued for focusing.
 */
export function scrollAndFocusFirstError(
  candidateIds: (string | undefined | null)[],
  options: ScrollAndFocusOptions = {},
): boolean {
  const { behavior = "smooth", block = "center", fallbackSelector } = options;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const tryFocus = (): boolean => {
    if (typeof document === "undefined") {
      return false;
    }
    for (const id of candidateIds) {
      if (!id) continue;
      const el =
        document.getElementById(id) ||
        document.querySelector(`[name="${id}"]`) ||
        document.querySelector(`[data-field-id="${id}"]`);

      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior, block });

        // If directly focusable form control
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLButtonElement
        ) {
          el.focus({ preventScroll: true });
          return true;
        }

        // Look for nested interactive control
        const inner = el.querySelector<HTMLElement>(
          'input:not([type="hidden"]), select, textarea, button, [tabindex]:not([tabindex="-1"])',
        );
        if (inner) {
          inner.focus({ preventScroll: true });
          return true;
        }

        // Fallback: make container programmatic focus target for screen readers
        if (!el.hasAttribute("tabindex")) {
          el.setAttribute("tabindex", "-1");
        }
        el.focus({ preventScroll: true });
        return true;
      }
    }

    if (fallbackSelector) {
      const fallback = document.querySelector<HTMLElement>(fallbackSelector);
      if (fallback) {
        fallback.scrollIntoView({ behavior, block });
        fallback.focus({ preventScroll: true });
        return true;
      }
    }

    // Ultimate fallback: first element with aria-invalid="true"
    const invalidEl = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalidEl) {
      invalidEl.scrollIntoView({ behavior, block });
      invalidEl.focus({ preventScroll: true });
      return true;
    }

    return false;
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (tryFocus()) return;
      window.setTimeout(() => {
        tryFocus();
      }, 50);
    });
  });

  return true;
}
