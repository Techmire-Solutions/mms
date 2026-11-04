import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TaskRecord } from "@mms/shared";
import { TasksWorkDirectory } from "./TasksWorkDirectory";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./TasksListDesktopTable", () => ({
  TasksListDesktopTable: () => <div data-testid="tasks-desktop-table" />,
}));

vi.mock("./TasksListCards", () => ({
  TasksListCards: () => <div data-testid="tasks-cards" />,
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
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const baseProps = {
  viewMode: "table" as const,
  tasks: [task],
  selectedIds: [] as string[],
  viewingDeleted: false,
  canWrite: true,
  canDelete: true,
  isLoading: false,
  isColumnVisible: () => true,
  getColumnWidth: () => undefined,
  onColumnResize: vi.fn(),
  onToggleSelected: vi.fn(),
  onToggleSelectAll: vi.fn(),
  onView: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onUpdateStatus: vi.fn(),
};

describe("TasksWorkDirectory", () => {
  it("renders the table by default", () => {
    const html = renderToStaticMarkup(<TasksWorkDirectory {...baseProps} />);
    expect(html).toContain("tasks-desktop-table");
  });

  it("renders the cards view when the view mode is cards", () => {
    const html = renderToStaticMarkup(<TasksWorkDirectory {...baseProps} viewMode="cards" />);
    expect(html).toContain("tasks-cards");
  });

  it("renders a retryable error state instead of the directory when the list fails", () => {
    const onRetry = vi.fn();
    const html = renderToStaticMarkup(
      <TasksWorkDirectory {...baseProps} isError onRetry={onRetry} tasks={[]} />,
    );
    expect(html).toContain("tasks.loadFailed");
    expect(html).toContain("tasks.loadFailedHint");
    // The failed list must not masquerade as an empty directory.
    expect(html).not.toContain("tasks-desktop-table");
    expect(html).toContain("common.tryAgain");
  });
});
