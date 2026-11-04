import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTasksWorkTabFilters } from "./useTasksWorkTabFilters";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let currentFiltersResult!: ReturnType<typeof useTasksWorkTabFilters>;

function HookHost(): React.JSX.Element {
  currentFiltersResult = useTasksWorkTabFilters();
  return <div />;
}

async function mount(): Promise<{ root: Root; container: HTMLElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<HookHost />);
  });
  return { root, container };
}

async function unmount(root: Root, container: HTMLElement): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

/** Advance past the leaf search debounce inside an act() flush. */
async function settleSearch(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
}

describe("useTasksWorkTabFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with no active filters", async () => {
    const { root, container } = await mount();
    expect(currentFiltersResult.activeChips).toHaveLength(0);
    expect(currentFiltersResult.hasActiveFilters).toBe(false);
    expect(currentFiltersResult.quickFilter).toBe("all");
    await unmount(root, container);
  });

  it("debounces search before it reaches the directory query", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setSearchInput("Beta");
    });
    expect(currentFiltersResult.searchInput).toBe("Beta");
    expect(currentFiltersResult.search).toBe("");

    await settleSearch();
    expect(currentFiltersResult.search).toBe("Beta");
    expect(currentFiltersResult.hasActiveFilters).toBe(true);
    await unmount(root, container);
  });

  it("renders a removable chip for every selected status", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setStatusFilter(["completed", "todo"]);
    });
    expect(currentFiltersResult.activeChips).toHaveLength(2);
    expect(currentFiltersResult.activeChips.map((chip) => chip.key)).toEqual([
      "status-completed",
      "status-todo",
    ]);
    expect(currentFiltersResult.hasActiveFilters).toBe(true);

    await act(async () => {
      currentFiltersResult.activeChips[0]?.onRemove();
    });
    expect(currentFiltersResult.statusFilter).toEqual(["todo"]);
    await unmount(root, container);
  });

  it("clears every dimension — including status and search — from clear filters", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setStatusFilter(["completed"]);
      currentFiltersResult.setPriorityFilter(["low"]);
      currentFiltersResult.setQuickFilter("overdue");
      currentFiltersResult.setDueFrom("2026-11-01");
      currentFiltersResult.setDueTo("2026-11-30");
      currentFiltersResult.setSearchInput("Beta");
    });
    await settleSearch();
    expect(currentFiltersResult.hasActiveFilters).toBe(true);

    await act(async () => {
      currentFiltersResult.handleClearFilters();
    });
    await settleSearch();

    expect(currentFiltersResult.statusFilter).toEqual([]);
    expect(currentFiltersResult.priorityFilter).toEqual([]);
    expect(currentFiltersResult.quickFilter).toBe("all");
    expect(currentFiltersResult.dueFrom).toBeUndefined();
    expect(currentFiltersResult.dueTo).toBeUndefined();
    expect(currentFiltersResult.searchInput).toBe("");
    expect(currentFiltersResult.search).toBe("");
    expect(currentFiltersResult.activeChips).toHaveLength(0);
    expect(currentFiltersResult.hasActiveFilters).toBe(false);
    await unmount(root, container);
  });

  it("offers the five quick-filter presets and renders one chip for the active preset", async () => {
    const { root, container } = await mount();
    expect(currentFiltersResult.quickFilterOptions).toHaveLength(6);

    await act(async () => {
      currentFiltersResult.setQuickFilter("open");
    });
    expect(currentFiltersResult.activeChips).toHaveLength(1);
    expect(currentFiltersResult.activeChips[0]?.key).toBe("quickFilter");

    await act(async () => {
      currentFiltersResult.setQuickFilter("all");
    });
    expect(currentFiltersResult.activeChips).toHaveLength(0);
    await unmount(root, container);
  });

  it("renders due-range chips and removes them individually", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setDueFrom("2026-11-01");
      currentFiltersResult.setDueTo("2026-11-30");
    });
    expect(currentFiltersResult.activeChips.map((chip) => chip.key)).toEqual(["dueFrom", "dueTo"]);
    await act(async () => {
      currentFiltersResult.activeChips[0]?.onRemove();
    });
    expect(currentFiltersResult.dueFrom).toBeUndefined();
    expect(currentFiltersResult.dueTo).toBe("2026-11-30");
    await unmount(root, container);
  });
});
