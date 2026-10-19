import { describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useWorkSelection, type WorkSelection } from "./useWorkSelection";

function renderWorkSelectionHook<T extends string | number = string>(
  visibleItems?: readonly { id: T }[],
) {
  const result: { current: WorkSelection<T> } = {} as { current: WorkSelection<T> };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function HookHost() {
    result.current = useWorkSelection<T>(visibleItems);
    return null;
  }

  act(() => {
    root.render(React.createElement(HookHost));
  });

  return {
    result,
    rerender: () => {
      act(() => {
        root.render(React.createElement(HookHost));
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useWorkSelection", () => {
  it("toggles a single id on and off", () => {
    const { result, unmount } = renderWorkSelectionHook<string>();
    try {
      act(() => result.current.toggleSelected("a", true));
      expect(result.current.selectedIds).toEqual(["a"]);
      act(() => result.current.toggleSelected("a", true)); // idempotent
      expect(result.current.selectedIds).toEqual(["a"]);
      act(() => result.current.toggleSelected("a", false));
      expect(result.current.selectedIds).toEqual([]);
    } finally {
      unmount();
    }
  });

  it("select-all adds visible ids and keeps selections from other pages", () => {
    const { result, unmount } = renderWorkSelectionHook<string>();
    try {
      act(() => result.current.toggleSelected("other-page", true));
      act(() => result.current.toggleSelectAll(true, ["a", "b"]));
      expect(result.current.selectedIds).toEqual(["other-page", "a", "b"]);
      act(() => result.current.toggleSelectAll(false, ["a", "b"]));
      expect(result.current.selectedIds).toEqual(["other-page"]);
    } finally {
      unmount();
    }
  });

  it("clearSelection empties and returns a stable reference", () => {
    const { result, rerender, unmount } = renderWorkSelectionHook<string>();
    try {
      const first = result.current.clearSelection;
      act(() => result.current.toggleSelected("a", true));
      rerender();
      expect(result.current.clearSelection).toBe(first);
      act(() => result.current.clearSelection());
      expect(result.current.selectedIds).toEqual([]);
    } finally {
      unmount();
    }
  });

  it("derives all/some-visible flags from the supplied items", () => {
    const items = [{ id: "a" }, { id: "b" }];
    const { result, unmount } = renderWorkSelectionHook<string>(items);
    try {
      expect(result.current.allVisibleSelected).toBe(false);
      expect(result.current.someVisibleSelected).toBe(false);
      act(() => result.current.toggleSelected("a", true));
      expect(result.current.someVisibleSelected).toBe(true);
      expect(result.current.allVisibleSelected).toBe(false);
      act(() => result.current.toggleSelectAll(true));
      expect(result.current.selectedIds).toEqual(["a", "b"]);
      expect(result.current.allVisibleSelected).toBe(true);
    } finally {
      unmount();
    }
  });

  it("list-bound select-all is a no-op reference when nothing changes", () => {
    const items = [{ id: "a" }, { id: "b" }];
    const { result, unmount } = renderWorkSelectionHook<string>(items);
    try {
      act(() => result.current.toggleSelectAll(true));
      const allSelectedBefore = result.current.selectedIds;
      act(() => result.current.toggleSelectAll(true));
      expect(result.current.selectedIds).toBe(allSelectedBefore);
      act(() => result.current.toggleSelectAll(false));
      const emptyBefore = result.current.selectedIds;
      act(() => result.current.toggleSelectAll(false));
      expect(result.current.selectedIds).toBe(emptyBefore);
    } finally {
      unmount();
    }
  });
});
