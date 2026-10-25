import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { TaskRecord } from "@mms/shared";
import { TaskDetailDrawer } from "./TaskDetailDrawer";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) =>
      p?.title ? `${k}:${String(p.title)}` : p?.count ? `${k}:${String(p.count)}` : k,
  }),
}));

const mockActiveTask: TaskRecord = {
  id: "task-active-1",
  workspaceSubdomain: "test",
  title: "Prepare Syllabus",
  description: "Outline curriculum for fall",
  status: "todo",
  priority: "high",
  startDate: "2026-09-01",
  dueAt: "2026-09-15T00:00:00.000Z",
  parentTaskId: null,
  createdById: "u-admin",
  creatorName: "Principal",
  assignees: [
    {
      id: "a-1",
      taskId: "task-active-1",
      facultyId: "f-1",
      userId: "u-1",
      facultyName: "Dr. Zaid",
    },
  ],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  deletedAt: null,
};

const mockArchivedTask: TaskRecord = {
  ...mockActiveTask,
  id: "task-archived-1",
  deletedAt: "2026-08-10T00:00:00.000Z",
};

describe("TaskDetailDrawer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders null when task is null", () => {
    act(() => {
      root.render(
        <TaskDetailDrawer task={null} canWrite={true} canDelete={true} onClose={vi.fn()} />,
      );
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders active task details and edit action", () => {
    const onEdit = vi.fn();

    act(() => {
      root.render(
        <TaskDetailDrawer
          task={mockActiveTask}
          canWrite={true}
          canDelete={true}
          onClose={vi.fn()}
          onEdit={onEdit}
        />,
      );
    });

    expect(document.body.textContent).toContain("Prepare Syllabus");
    expect(document.body.textContent).toContain("Outline curriculum for fall");
    expect(document.body.textContent).toContain("Dr. Zaid");

    const editBtn = document.body.querySelector('button[aria-label="common.edit"]');
    expect(editBtn).toBeTruthy();
    act(() => {
      editBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onEdit).toHaveBeenCalledWith(mockActiveTask);
  });

  it("renders archived banner and restore action when task is soft-deleted", async () => {
    const onRestore = vi.fn();

    act(() => {
      root.render(
        <TaskDetailDrawer
          task={mockArchivedTask}
          canWrite={true}
          canDelete={true}
          onClose={vi.fn()}
          onRestore={onRestore}
        />,
      );
    });

    expect(document.body.textContent).toContain("Prepare Syllabus");
    const editBtn = document.body.querySelector('button[aria-label="common.edit"]');
    expect(editBtn).toBeNull();

    const restoreBtn = document.body.querySelector('button[aria-label="tasks.restore"]');
    expect(restoreBtn).toBeTruthy();
    await act(async () => {
      restoreBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRestore).toHaveBeenCalledWith(mockArchivedTask.id);
  });
});
