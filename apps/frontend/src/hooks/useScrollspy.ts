/**
 * Modern Web Guidance: scrollspy
 * Returns the `id` of the section currently visible in the scrolling viewport.
 *
 * Strategy:
 *  - Chrome/Edge 140+: CSS `scroll-target-group: auto` + `:target-current` handle
 *    the visual highlight natively. This hook returns `null` so the caller skips
 *    any JS-driven class toggling.
 *  - Firefox / Safari: `IntersectionObserver` fallback with a ±50% rootMargin so
 *    the section that occupies the vertical middle of the viewport wins.
 *    The caller should toggle `\:target-current` class on the anchor for consistent
 *    CSS selector matching.
 *
 * @param sectionIds  Ordered list of section `id` strings to observe.
 * @returns The id of the currently intersecting section, or `null` when native
 *          CSS handles it (feature detected) or when no section is intersecting.
 *
 * @example
 * ```tsx
 * const activeId = useScrollspy(["intro", "features", "pricing"]);
 * // In supporting browsers, activeId is always null — CSS drives the highlight.
 * // In Firefox/Safari, activeId changes as the user scrolls.
 * ```
 */
import { useEffect, useRef, useState } from "react";

export function isNativeScrollspySupported(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }
  return CSS.supports("scroll-target-group", "auto");
}

export function useScrollspy(sectionIds: readonly string[]): string | null {
  const isNative = isNativeScrollspySupported();
  const [activeId, setActiveId] = useState<string | null>(null);
  const idsRef = useRef(sectionIds);
  idsRef.current = sectionIds;

  useEffect(() => {
    if (isNative || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );

    const elements = idsRef.current
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [isNative]);

  if (isNative) return null;
  return activeId;
}
