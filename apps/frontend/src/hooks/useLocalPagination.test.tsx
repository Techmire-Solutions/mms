import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useLocalPagination } from "./useLocalPagination";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useLocalPagination", () => {
  it("does not enter an infinite render loop when items array is unmemoized across re-renders", () => {
    let renderCount = 0;
    let hookResult!: ReturnType<typeof useLocalPagination<string>>;
    let triggerRerender!: () => void;

    function TestHost() {
      renderCount++;
      const [, setTick] = useState(0);
      triggerRerender = () => setTick((t) => t + 1);

      // Produces a fresh array identity on every render pass
      const unmemoizedItems = ["alpha", "beta", "gamma", "delta", "epsilon"].filter(Boolean);

      hookResult = useLocalPagination({
        items: unmemoizedItems,
        pageSize: 2,
      });

      return <div>Render count: {renderCount}</div>;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestHost />);
    });

    expect(renderCount).toBe(1);
    expect(hookResult.paginatedItems).toEqual(["alpha", "beta"]);
    expect(hookResult.totalPages).toBe(3);
    expect(hookResult.currentPage).toBe(1);

    // Re-render host component with a new items reference
    act(() => {
      triggerRerender();
    });

    // Should only have rendered once more (renderCount = 2), not looped infinitely (React error 301)
    expect(renderCount).toBe(2);
    expect(hookResult.paginatedItems).toEqual(["alpha", "beta"]);

    act(() => root.unmount());
    container.remove();
  });

  it("safely clamps currentPage when items shrink without in-render setState loop", () => {
    let hookResult!: ReturnType<typeof useLocalPagination<string>>;
    let setItemsList!: (items: string[]) => void;

    function TestHost() {
      const [items, setItems] = useState(["a", "b", "c", "d", "e", "f"]);
      setItemsList = setItems;

      hookResult = useLocalPagination({
        items,
        pageSize: 2,
      });

      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestHost />);
    });

    expect(hookResult.totalPages).toBe(3);
    expect(hookResult.currentPage).toBe(1);

    // Navigate to page 3
    act(() => {
      hookResult.setCurrentPage(3);
    });

    expect(hookResult.currentPage).toBe(3);
    expect(hookResult.paginatedItems).toEqual(["e", "f"]);

    // Now shrink items so only 1 page exists
    act(() => {
      setItemsList(["only-one"]);
    });

    expect(hookResult.totalPages).toBe(1);
    expect(hookResult.currentPage).toBe(1);
    expect(hookResult.paginatedItems).toEqual(["only-one"]);

    act(() => root.unmount());
    container.remove();
  });

  it("resets page and filters items when handleSearchChange is called", () => {
    let hookResult!: ReturnType<typeof useLocalPagination<string>>;

    function TestHost() {
      hookResult = useLocalPagination({
        items: ["apple", "apricot", "banana", "blueberry", "cherry"],
        pageSize: 2,
        searchFields: (item) => [item],
      });

      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestHost />);
    });

    act(() => {
      hookResult.setCurrentPage(2);
    });
    expect(hookResult.currentPage).toBe(2);

    act(() => {
      hookResult.handleSearchChange("ap");
    });

    expect(hookResult.searchQuery).toBe("ap");
    expect(hookResult.currentPage).toBe(1);
    expect(hookResult.filteredItems).toEqual(["apple", "apricot"]);
    expect(hookResult.paginatedItems).toEqual(["apple", "apricot"]);

    act(() => root.unmount());
    container.remove();
  });
});
