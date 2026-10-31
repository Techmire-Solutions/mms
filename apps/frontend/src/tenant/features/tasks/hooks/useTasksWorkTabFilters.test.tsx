import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { TaskRecord } from "@mms/shared";
import { useTasksWorkTabFilters } from "./useTasksWorkTabFilters";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockTasks: TaskRecord[] = [
  {
    id: "task-1",
    workspaceSubdomain: "demo",
    title: "Alpha Task",
    description: "First task desc",
    priority: "high",
    status: "todo",
    dueAt: "2026-10-30T10:00:00Z",
    startDate: "2026-10-20",
    parentTaskId: null,
    assignees: [
      {
        id: "asg-1",
        taskId: "task-1",
        userId: "user-1",
        facultyId: "fac-1",
        facultyName: "Zaid Khan",
      },
    ],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "task-2",
    workspaceSubdomain: "demo",
    title: "Beta Task",
    description: "Second task desc",
    priority: "low",
    status: "completed",
    dueAt: "2026-11-15T10:00:00Z",
    startDate: "2026-11-01",
    parentTaskId: null,
    assignees: [
      {
        id: "asg-2",
        taskId: "task-2",
        userId: "user-2",
        facultyId: "fac-2",
        facultyName: "Fatima Ali",
      },
    ],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
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

describe("useTasksWorkTabFilters", () => {
  it("returns all tasks by default without active filters", async () => {
    const { root, container } = await mount();
    expect(currentFiltersResult.filteredTasks).toHaveLength(2);
    expect(currentFiltersResult.activeChips).toHaveLength(0);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("filters tasks by search string matching title, desc, or assignee", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setSearch("Beta");
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-2");

    await act(async () => {
      currentFiltersResult.setSearch("Zaid");
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-1");
    await act(async () => {
      root.unmount();
    });
    container.remove();
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
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("filters tasks by quickFilter presets (open, urgent_high)", async () => {
    const { root, container } = await mount();
    expect(currentFiltersResult.quickFilterOptions).toHaveLength(5);

    await act(async () => {
      currentFiltersResult.setQuickFilter("open");
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-1");
    expect(currentFiltersResult.activeChips).toHaveLength(1);

    await act(async () => {
      currentFiltersResult.setQuickFilter("urgent_high");
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-1");

    await act(async () => {
      currentFiltersResult.setQuickFilter("all");
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(2);
    expect(currentFiltersResult.activeChips).toHaveLength(0);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("filters tasks by due date range and clears all filters", async () => {
    const { root, container } = await mount();
    await act(async () => {
      currentFiltersResult.setDueFrom("2026-11-01");
      currentFiltersResult.setDueTo("2026-11-30");
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(1);
    expect(currentFiltersResult.filteredTasks[0].id).toBe("task-2");
    expect(currentFiltersResult.activeChips).toHaveLength(2);

    await act(async () => {
      currentFiltersResult.handleClearFilters();
    });
    expect(currentFiltersResult.filteredTasks).toHaveLength(2);
    expect(currentFiltersResult.activeChips).toHaveLength(0);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
