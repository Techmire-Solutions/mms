import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskRecord } from "@mms/shared";
import { useTasksWorkTabFilters } from "./useTasksWorkTabFilters";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Pin the workspace-local "today" so the due-date assertions never depend on the
// runner's timezone. The production bug used a UTC slice of `new Date()`, which
// disagrees with this local calendar day for the first UTC-offset hours.
vi.mock("@mms/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/shared")>();
  return { ...actual, todayISO: () => "2026-11-04" };
});

const baseTask = {
  workspaceSubdomain: "demo",
  description: "",
  parentTaskId: null,
  assignees: [],
  startDate: "2026-10-20",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

const mockTasks: TaskRecord[] = [
  {
    ...baseTask,
    id: "task-1",
    title: "Alpha Task",
    priority: "high",
    status: "todo",
    dueAt: "2026-10-30T10:00:00Z",
    assignees: [
      {
        id: "asg-1",
        taskId: "task-1",
        userId: "user-1",
        facultyId: "fac-1",
        facultyName: "Zaid Khan",
      },
    ],
  },
  {
    ...baseTask,
    id: "task-2",
    title: "Beta Task",
    priority: "low",
    status: "completed",
    dueAt: "2026-11-15T10:00:00Z",
  },
  {
    ...baseTask,
    id: "task-3",
    title: "Due Today Task",
    priority: "medium",
    status: "in_progress",
    dueAt: "2026-11-04T09:00:00+05:00",
  },
];

let currentFiltersResult!: ReturnType<typeof useTasksWorkTabFilters>;

function HookHost(): React.JSX.Element {
  currentFiltersResult = useTasksWorkTabFilters(mockTasks);
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
    // 00:30 Asia/Karachi on 2026-11-04 == 19:30 UTC on 2026-11-03.
    vi.setSystemTime(new Date("2026-11-03T19:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns all tasks by default without active filters", async () => {
    const { root, container } = await mount();
    expect(currentFiltersResult.filteredTasks).toHaveLength(3);
    expect(currentFiltersResult.activeChips).toHaveLength(0);
    expect(currentFiltersResult.hasActiveFilters).toBe(false);
    await unmount(root, container);
  });

  it("debounces search before it reaches the directory query", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setSearchInput("Beta");
    });
    // Raw input is immediate, the committed filter value is not.
    expect(currentFiltersResult.searchInput).toBe("Beta");
    expect(currentFiltersResult.search).toBe("");

    await settleSearch();
    expect(currentFiltersResult.search).toBe("Beta");
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-2");

    await act(async () => {
      currentFiltersResult.setSearchInput("Zaid");
    });
    await settleSearch();
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-1");
    await unmount(root, container);
  });

  it("filters tasks by status and priority", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setStatusFilter(["completed"]);
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-2");

    await act(async () => {
      currentFiltersResult.setStatusFilter([]);
      currentFiltersResult.setPriorityFilter(["high"]);
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-1");
    expect(currentFiltersResult.activeChips).toHaveLength(1);
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

    // Removing one chip drops exactly that status.
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
    expect(currentFiltersResult.filteredTasks).toHaveLength(3);
    await unmount(root, container);
  });

  it("resolves 'due today' against the local calendar day, not UTC", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setQuickFilter("due_today");
    });
    // task-3 is due on the local day (2026-11-04) while a UTC slice would say
    // 2026-11-03 and hide it.
    expect(currentFiltersResult.filteredTasks.map((task) => task.id)).toEqual(["task-3"]);
    await unmount(root, container);
  });

  it("filters tasks by quickFilter presets (open, urgent_high)", async () => {
    const { root, container } = await mount();
    expect(currentFiltersResult.quickFilterOptions).toHaveLength(5);

    await act(async () => {
      currentFiltersResult.setQuickFilter("open");
    });
    expect(currentFiltersResult.filteredTasks.map((task) => task.id)).toEqual(["task-1", "task-3"]);
    expect(currentFiltersResult.activeChips).toHaveLength(1);

    await act(async () => {
      currentFiltersResult.setQuickFilter("urgent_high");
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-1");

    await act(async () => {
      currentFiltersResult.setQuickFilter("all");
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(3);
    expect(currentFiltersResult.activeChips).toHaveLength(0);
    await unmount(root, container);
  });

  it("filters tasks by due date range and clears all filters", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setDueFrom("2026-11-01");
      currentFiltersResult.setDueTo("2026-11-30");
    });
    expect(currentFiltersResult.filteredTasks.map((task) => task.id)).toEqual(["task-2", "task-3"]);
    expect(currentFiltersResult.activeChips).toHaveLength(2);

    await act(async () => {
      currentFiltersResult.handleClearFilters();
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(3);
    expect(currentFiltersResult.activeChips).toHaveLength(0);
    await unmount(root, container);
  });
});
