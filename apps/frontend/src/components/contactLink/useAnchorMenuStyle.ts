import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Modern Web Guidance: defer-work-until-scroll-ends
 * Floating anchor positioning hook that settles accurately on `scrollend`
 * and uses requestAnimationFrame throttling during active scrolling to avoid
 * main-thread saturation and layout thrashing.
 */
export function useAnchorMenuStyle(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;

    let rafId: number | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const supportsScrollEnd = typeof window !== "undefined" && "onscrollend" in window;

    const update = (): void => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const gap = 6;
      const maxHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const placeAbove = spaceBelow < 160 && rect.top > spaceBelow;
      setStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        zIndex: "var(--z-index-popover)",
        maxHeight,
        ...(placeAbove
          ? { bottom: window.innerHeight - rect.top + gap, top: "auto" }
          : { top: rect.bottom + gap, bottom: "auto" }),
      });
    };

    const handleThrottledScroll = (): void => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(() => {
          update();
          rafId = null;
        });
      }

      if (!supportsScrollEnd) {
        if (fallbackTimer !== null) clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(() => {
          update();
        }, 100);
      }
    };

    const handleScrollEnd = (): void => {
      update();
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", handleThrottledScroll, true);
    if (supportsScrollEnd) {
      window.addEventListener("scrollend", handleScrollEnd, true);
    }

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", handleThrottledScroll, true);
      if (supportsScrollEnd) {
        window.removeEventListener("scrollend", handleScrollEnd, true);
      }
    };
  }, [open, anchorRef]);

  return style;
}
