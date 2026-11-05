import { useEffect, useRef } from "react";

export interface UseRovingToolbarOptions {
  selector?: string;
}

/**
 * WAI-ARIA toolbar keyboard model: one tab stop, arrow keys move between items,
 * Home/End jump to the edges, RTL swaps the horizontal arrows. Nested menus,
 * listboxes and tablists keep their own arrow handling.
 */
export function useRovingToolbar<T extends HTMLElement = HTMLDivElement>({
  selector = "[data-toolbar-item]",
}: UseRovingToolbarOptions = {}): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const getItems = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (item) => !item.hasAttribute("disabled") && item.getAttribute("aria-hidden") !== "true",
      );

    const setCurrent = (current: HTMLElement | null): void => {
      const items = getItems();
      if (items.length === 0) return;
      const next = current && items.includes(current) ? current : (items[0] ?? null);
      items.forEach((item) => {
        item.tabIndex = item === next ? 0 : -1;
      });
    };

    const items = getItems();
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    setCurrent(
      active && items.includes(active)
        ? active
        : (items.find((item) => item.tabIndex === 0) ?? items[0] ?? null),
    );

    const isRtl = (): boolean =>
      (root.closest("[dir]")?.getAttribute("dir") ?? window.getComputedStyle(root).direction) ===
      "rtl";

    const handleFocusIn = (event: FocusEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && getItems().includes(target)) setCurrent(target);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('[role="menu"], [role="listbox"], [role="tablist"]')) return;
      const list = getItems();
      const index = list.indexOf(document.activeElement as HTMLElement);
      if (index === -1) return;
      event.preventDefault();
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? list.length - 1
            : event.key === (isRtl() ? "ArrowLeft" : "ArrowRight")
              ? (index + 1) % list.length
              : (index - 1 + list.length) % list.length;
      const next = list[nextIndex];
      next?.focus();
      setCurrent(next ?? null);
    };

    root.addEventListener("focusin", handleFocusIn);
    root.addEventListener("keydown", handleKeyDown);
    return () => {
      root.removeEventListener("focusin", handleFocusIn);
      root.removeEventListener("keydown", handleKeyDown);
    };
  });

  return ref;
}
