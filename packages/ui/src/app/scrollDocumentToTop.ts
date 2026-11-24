export type ScrollDocumentToTopOptions = {
  /** Defaults to `auto` for route resets; use `smooth` for in-page jumps. */
  behavior?: ScrollBehavior;
};

export type ScrollPageSurfaceToTopOptions = ScrollDocumentToTopOptions & {
  /**
   * Mobile accordion / section target. When provided below the `lg` breakpoint,
   * scrolls that element into view instead of resetting the document.
   */
  mobileTarget?: HTMLElement | null;
  /** Used with `mobileTarget`. Defaults to `start`. */
  block?: ScrollLogicalPosition;
};

import { BREAKPOINT_LG_PX } from "./breakpoints";

const MAIN_CONTENT_ID = "main-content";

/** Disable browser scroll restoration so SPA navigations own scroll position. */
export function disableBrowserScrollRestoration(): void {
  if (typeof window === "undefined") return;
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
}

/** Reset window/document (and `#main-content`) scroll to the top. */
export function scrollDocumentToTop(options: ScrollDocumentToTopOptions = {}): void {
  if (typeof window === "undefined") return;

  const behavior = options.behavior ?? "auto";
  window.scrollTo({ top: 0, left: 0, behavior });

  // Instantly sync nested scrollers; skip during smooth so animation is not cancelled.
  if (behavior !== "smooth") {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (main) {
      main.scrollTop = 0;
    }
  }
}

/**
 * Scroll policy for opening a page surface (route or tier tab).
 * Desktop → document top; mobile accordion → optional section target.
 */
export function scrollPageSurfaceToTop(options: ScrollPageSurfaceToTopOptions = {}): void {
  if (typeof window === "undefined") return;

  const behavior = options.behavior ?? "auto";
  if (window.innerWidth < BREAKPOINT_LG_PX && options.mobileTarget) {
    options.mobileTarget.scrollIntoView({
      behavior,
      block: options.block ?? "start",
    });
    return;
  }

  scrollDocumentToTop({ behavior });
}
