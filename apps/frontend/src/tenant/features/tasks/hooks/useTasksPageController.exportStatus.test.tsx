import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskRecord } from "@mms/shared";
import { useTasksPageController } from "./useTasksPageController";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  updateStatusMutate: vi.fn(),
  exportOptions: null as Record<string, unknown> | null,
  state: { total: 1 },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/useDirectoryTrashState", () => ({
  useDirectoryTrashState: () => [false, vi.fn(), vi.fn()],
}));

vi.mock("@/lib/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn(), archivedWithUndo: vi.fn() },
}));

vi.mock("@/lib/backgroundJobs/useGenericModuleExport", () => ({
  useGenericModuleExport: (options: Record<string, unknown>) => {
    mocks.exportOptions = options;
    return { handleExport: vi.fn(), isExporting: false };
  },
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => false }),
  useModulePermissions: () => ({
    canRead: true,
    canWrite: true,
    canDelete: true,
    canEditSetup: false,
    canViewSetup: false,
  }),
}));

vi.mock("@/tenant/hooks/collections/tasks", () => ({
  useTasks: () => ({
    data: { tasks: [], total: mocks.state.total },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useTaskMetrics: () => ({ data: undefined }),
  useCreateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTaskStatus: () => ({ mutate: mocks.updateStatusMutate, isPending: false }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useRestoreTask: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

const task: TaskRecord = {
  id: "task-1",
  workspaceSubdomain: "demo",
  title: "Review Midterm Exams",
  description: "",
  status: "in_progress",
  priority: "urgent",
  dueAt: null,
  parentTaskId: null,
  assignees: [],
  updatedAt: "2026-10-02T00:00:00.000Z",
};

let controller!: ReturnType<typeof useTasksPageController>;
let root: Root;
let container: HTMLElement;

function Host(): React.JSX.Element {
  controller = useTasksPageController();
  return <div />;
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Host />);
  });
}

async function unmount(): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

describe("useTasksPageController status, export and paging", () => {
  beforeEach(() => {
    mocks.state.total = 1;
    mocks.updateStatusMutate.mockReset();
    mocks.exportOptions = null;
  });

  it("sends the row's updatedAt when changing status", async () => {
    await mount();
    await act(async () => {
      controller.handleUpdateStatus(task, "completed");
    });
    expect(mocks.updateStatusMutate).toHaveBeenCalledWith(
      { id: task.id, status: "completed", expectedUpdatedAt: "2026-10-02T00:00:00.000Z" },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    await unmount();
  });

  it("scopes export to the active filters and selection without a client audit row", async () => {
    await mount();
    await act(async () => {
      controller.handleServerFiltersChange({ statuses: "todo,blocked", overdue: true });
      controller.toggleSelected(task.id, true);
    });
    expect(mocks.exportOptions?.query).toMatchObject({
      statuses: "todo,blocked",
      overdue: true,
      ids: task.id,
    });
    expect(mocks.exportOptions?.auditPath).toBeUndefined();
    await unmount();
  });

  it("clamps a page index that lands past the last page", async () => {
    await mount();
    await act(async () => {
      controller.setPageIndex(4);
    });
    expect(controller.pageIndex).toBe(0);
    await unmount();
  });
});
