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
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  updateStatusMutate: vi.fn(),
  deleteMutate: vi.fn(),
  restoreMutate: vi.fn(),
  restoreMutateAsync: vi.fn(),
  refetchTasks: vi.fn(),
  archivedWithUndo: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  setViewingDeleted: vi.fn(),
  state: {
    tasks: [] as unknown[],
    total: 0,
    isLoading: false,
    isError: false,
    canWrite: true,
    canDelete: true,
    viewingDeleted: false,
    can: ((_permission: string): boolean => false) as (permission: string) => boolean,
  },
}));

const {
  createMutate,
  updateMutate,
  updateStatusMutate,
  deleteMutate,
  restoreMutate,
  restoreMutateAsync,
  refetchTasks,
  archivedWithUndo,
  notifyError,
  notifySuccess,
  setViewingDeleted,
} = mocks;
const state = mocks.state as {
  tasks: TaskRecord[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  canWrite: boolean;
  canDelete: boolean;
  viewingDeleted: boolean;
  can: (permission: string) => boolean;
};

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/useDirectoryTrashState", () => ({
  useDirectoryTrashState: () => [
    mocks.state.viewingDeleted as boolean,
    mocks.setViewingDeleted,
    vi.fn(),
  ],
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    archivedWithUndo: mocks.archivedWithUndo,
    error: mocks.notifyError,
    success: mocks.notifySuccess,
  },
}));

vi.mock("@/lib/backgroundJobs/useGenericModuleExport", () => ({
  useGenericModuleExport: () => ({ handleExport: vi.fn(), isExporting: false }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (p: string) => mocks.state.can(p) }),
  useModulePermissions: () => ({
    canRead: true,
    canWrite: mocks.state.canWrite,
    canDelete: mocks.state.canDelete,
    canEditSetup: true,
    canViewSetup: true,
  }),
}));

vi.mock("@/tenant/hooks/collections/tasks", () => ({
  useTasks: () => ({
    data: { tasks: mocks.state.tasks, total: mocks.state.total },
    isLoading: mocks.state.isLoading,
    isError: mocks.state.isError,
    refetch: mocks.refetchTasks,
  }),
  useTaskMetrics: () => ({ data: { total: 3, inProgress: 1, completed: 1 } }),
  useCreateTask: () => ({ mutateAsync: mocks.createMutate }),
  useUpdateTask: () => ({ mutateAsync: mocks.updateMutate }),
  useUpdateTaskStatus: () => ({ mutate: mocks.updateStatusMutate }),
  useDeleteTask: () => ({ mutate: mocks.deleteMutate }),
  useRestoreTask: () => ({
    mutate: mocks.restoreMutate,
    mutateAsync: mocks.restoreMutateAsync,
  }),
}));

const task: TaskRecord = {
  id: "a0000000-0000-0000-0000-000000000001",
  workspaceSubdomain: "test",
  title: "Review Midterm Exams",
  description: "",
  status: "in_progress",
  priority: "urgent",
  dueAt: null,
  parentTaskId: null,
  assignees: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

const newTaskPayload = {
  title: "New task",
  status: "todo" as const,
  priority: "medium" as const,
  assignees: [],
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

describe("useTasksPageController", () => {
  beforeEach(() => {
    mocks.state.viewingDeleted = false;
    setViewingDeleted.mockReset();
    state.tasks = [task];
    state.total = 1;
    state.isLoading = false;
    state.isError = false;
    state.canWrite = true;
    state.canDelete = true;
    state.can = () => false;
    for (const fn of [
      createMutate,
      updateMutate,
      updateStatusMutate,
      deleteMutate,
      restoreMutate,
      restoreMutateAsync,
      refetchTasks,
      archivedWithUndo,
      notifyError,
      notifySuccess,
    ]) {
      fn.mockReset();
    }
    restoreMutateAsync.mockResolvedValue(undefined);
  });

  it("exposes the work/reports/setup tabs in order", async () => {
    await mount();
    expect(controller.pageTabs.map((tab) => tab.id)).toEqual(["work", "reports", "setup"]);
    expect(controller.activeTab).toBe("work");
    await unmount();
  });

  it("creates when no task is being edited", async () => {
    await mount();
    await act(async () => {
      controller.handleOpenCreate();
    });
    expect(controller.formOpen).toBe(true);
    expect(controller.editingTask).toBeNull();

    await act(async () => {
      await controller.handleSave(newTaskPayload);
    });
    expect(createMutate).toHaveBeenCalledWith(newTaskPayload);
    expect(updateMutate).not.toHaveBeenCalled();
    await unmount();
  });

  it("edits with the row's updatedAt so a concurrent edit is a 409", async () => {
    await mount();
    await act(async () => {
      controller.handleOpenEdit(task);
    });
    expect(controller.editingTask).toEqual(task);

    await act(async () => {
      await controller.handleSave({ ...newTaskPayload, title: "Renamed" });
    });
    expect(updateMutate).toHaveBeenCalledWith({
      id: task.id,
      data: { ...newTaskPayload, title: "Renamed" },
      expectedUpdatedAt: "2026-10-02T00:00:00.000Z",
    });
    await unmount();
  });

  it("archives with an undo that restores the task", async () => {
    await mount();
    await act(async () => {
      controller.handleDelete(task.id);
    });
    expect(deleteMutate).toHaveBeenCalledTimes(1);

    const [, options] = deleteMutate.mock.calls[0] as [string, { onSuccess: () => void }];
    await act(async () => {
      options.onSuccess();
    });
    expect(archivedWithUndo).toHaveBeenCalledTimes(1);

    const undo = archivedWithUndo.mock.calls[0]?.[1] as () => void;
    act(() => {
      undo();
    });
    expect(restoreMutateAsync).toHaveBeenCalledWith(task.id);
    await unmount();
  });

  it("blocks create and edit while the trash is open", async () => {
    mocks.state.viewingDeleted = true;
    await mount();
    await act(async () => {
      controller.handleOpenCreate();
    });
    expect(controller.formOpen).toBe(false);

    await act(async () => {
      controller.handleOpenEdit(task);
    });
    expect(controller.formOpen).toBe(false);
    expect(controller.editingTask).toBeNull();
    await unmount();
  });

  it("gates task completion on the complete permission when the user cannot write", async () => {
    state.canWrite = false;
    state.can = (permission) => permission === "tasks.complete";
    await mount();
    expect(controller.canWrite).toBe(false);
    expect(controller.canComplete).toBe(true);
    await unmount();
  });

  it("surfaces a retry for a failed directory load", async () => {
    state.isError = true;
    await mount();
    expect(controller.tasksError).toBe(true);

    act(() => {
      controller.handleRetry();
    });
    expect(refetchTasks).toHaveBeenCalledTimes(1);
    await unmount();
  });
});
