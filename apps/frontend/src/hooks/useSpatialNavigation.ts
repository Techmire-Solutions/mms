import { useEffect, useRef, useState, useCallback } from "react";

export interface UseSpatialNavigationOptions {
  /** CSS selector for navigable items within the container (default: '[data-spatial-item]') */
  selector?: string;
  /** Initial active index (default: 0) */
  defaultActiveIndex?: number;
  /** Navigation direction axis (default: 'both') */
  axis?: "both" | "horizontal" | "vertical";
  /** Callback fired when an item receives spatial focus */
  onFocusItem?: (element: HTMLElement, index: number) => void;
}

export interface UseSpatialNavigationReturn<T extends HTMLElement> {
  containerRef: React.RefObject<T | null>;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

interface SpatialCandidate {
  element: HTMLElement;
  index: number;
  rect: DOMRect;
}

/**
 * Modern Web Guidance: spatial-navigation
 * Implements accessible 2D directional arrow-key navigation with roving tabindex.
 * Respects boundaries by omitting preventDefault() on boundary edges to preserve native scrolling.
 */
export function useSpatialNavigation<T extends HTMLElement = HTMLDivElement>(
  options: UseSpatialNavigationOptions = {},
): UseSpatialNavigationReturn<T> {
  const {
    selector = "[data-spatial-item]",
    defaultActiveIndex = 0,
    axis = "both",
    onFocusItem,
  } = options;

  const containerRef = useRef<T | null>(null);
  const [activeIndex, setActiveIndex] = useState(defaultActiveIndex);

  const getItems = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    const elements = containerRef.current.querySelectorAll<HTMLElement>(selector);
    return Array.from(elements).filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !el.hasAttribute("disabled") &&
        el.getAttribute("aria-disabled") !== "true"
      );
    });
  }, [selector]);

  // Synchronize roving tabindex across candidate items
  useEffect(() => {
    const items = getItems();
    if (items.length === 0) return;

    items.forEach((item, index) => {
      item.tabIndex = index === activeIndex ? 0 : -1;
    });
  }, [getItems, activeIndex]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const key = event.key;
      const isHorizontal = key === "ArrowLeft" || key === "ArrowRight";
      const isVertical = key === "ArrowUp" || key === "ArrowDown";

      if (!isHorizontal && !isVertical) return;
      if (axis === "horizontal" && !isHorizontal) return;
      if (axis === "vertical" && !isVertical) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        target.matches("input, textarea, select, [contenteditable='true'], [role='slider']") &&
        !target.matches(selector)
      ) {
        return;
      }

      const items = getItems();
      if (items.length <= 1) return;

      const currentIdx = activeIndex >= 0 && activeIndex < items.length ? activeIndex : 0;
      const currentEl = items[currentIdx];
      const currentRect = currentEl.getBoundingClientRect();

      const candidates: SpatialCandidate[] = [];
      items.forEach((element, index) => {
        if (index === currentIdx) return;
        candidates.push({
          element,
          index,
          rect: element.getBoundingClientRect(),
        });
      });

      let bestCandidate: SpatialCandidate | null = null;
      let minDistance = Infinity;

      for (const cand of candidates) {
        let isDirectionalMatch = false;
        let primaryDist = 0;
        let secondaryDist = 0;

        if (key === "ArrowRight") {
          isDirectionalMatch = cand.rect.left >= currentRect.right - 2;
          if (isDirectionalMatch) {
            primaryDist = cand.rect.left - currentRect.right;
            const overlap = Math.max(
              0,
              Math.min(currentRect.bottom, cand.rect.bottom) -
                Math.max(currentRect.top, cand.rect.top),
            );
            secondaryDist =
              overlap > 0
                ? 0
                : Math.min(
                    Math.abs(cand.rect.top - currentRect.bottom),
                    Math.abs(cand.rect.bottom - currentRect.top),
                  );
          }
        } else if (key === "ArrowLeft") {
          isDirectionalMatch = cand.rect.right <= currentRect.left + 2;
          if (isDirectionalMatch) {
            primaryDist = currentRect.left - cand.rect.right;
            const overlap = Math.max(
              0,
              Math.min(currentRect.bottom, cand.rect.bottom) -
                Math.max(currentRect.top, cand.rect.top),
            );
            secondaryDist =
              overlap > 0
                ? 0
                : Math.min(
                    Math.abs(cand.rect.top - currentRect.bottom),
                    Math.abs(cand.rect.bottom - currentRect.top),
                  );
          }
        } else if (key === "ArrowDown") {
          isDirectionalMatch = cand.rect.top >= currentRect.bottom - 2;
          if (isDirectionalMatch) {
            primaryDist = cand.rect.top - currentRect.bottom;
            const overlap = Math.max(
              0,
              Math.min(currentRect.right, cand.rect.right) -
                Math.max(currentRect.left, cand.rect.left),
            );
            secondaryDist =
              overlap > 0
                ? 0
                : Math.min(
                    Math.abs(cand.rect.left - currentRect.right),
                    Math.abs(cand.rect.right - currentRect.left),
                  );
          }
        } else if (key === "ArrowUp") {
          isDirectionalMatch = cand.rect.bottom <= currentRect.top + 2;
          if (isDirectionalMatch) {
            primaryDist = currentRect.top - cand.rect.bottom;
            const overlap = Math.max(
              0,
              Math.min(currentRect.right, cand.rect.right) -
                Math.max(currentRect.left, cand.rect.left),
            );
            secondaryDist =
              overlap > 0
                ? 0
                : Math.min(
                    Math.abs(cand.rect.left - currentRect.right),
                    Math.abs(cand.rect.right - currentRect.left),
                  );
          }
        }

        if (isDirectionalMatch) {
          const score = primaryDist + secondaryDist * 2;
          if (score < minDistance) {
            minDistance = score;
            bestCandidate = cand;
          }
        }
      }

      if (bestCandidate) {
        event.preventDefault();
        bestCandidate.element.focus();
        if (typeof bestCandidate.element.scrollIntoView === "function") {
          bestCandidate.element.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
        setActiveIndex(bestCandidate.index);
        onFocusItem?.(bestCandidate.element, bestCandidate.index);
      }
    },
    [axis, selector, activeIndex, getItems, onFocusItem],
  );

  return {
    containerRef,
    activeIndex,
    setActiveIndex,
    onKeyDown,
  };
}
