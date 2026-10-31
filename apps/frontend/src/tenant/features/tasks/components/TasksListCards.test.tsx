import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TaskRecord } from "@mms/shared";
import { TasksListCards } from "./TasksListCards";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) =>
      params?.count !== undefined ? `${key}:${params.count}` : key,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/components/app/ModuleDirectoryCards", () => ({
  ModuleDirectoryCards: ({
    items,
    renderItem,
  }: {
    items: TaskRecord[];
    renderItem: (task: TaskRecord) => React.ReactNode;
  }) => <div data-testid="module-cards">{items.map((item) => renderItem(item))}</div>,
}));

vi.mock("./TaskCardItem", () => ({
  TaskCardItem: ({ task }: { task: TaskRecord }) => <div>{task.title}</div>,
}));

const mockTask: TaskRecord = {
  id: "a0000000-0000-0000-0000-000000000001",
  workspaceSubdomain: "test",
  title: "Card Task",
  description: null,
  status: "todo",
  priority: "medium",
  dueAt: null,
  createdById: null,
  creatorName: undefined,
  parentTaskId: null,
  assignees: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
};

const baseProps = {
  tasks: [mockTask],
  selectedIds: [] as string[],
  viewingDeleted: false,
  canWrite: true,
  canDelete: true,
  isLoading: false,
  isColumnVisible: () => true,
  onToggleSelected: vi.fn(),
  onToggleSelectAll: vi.fn(),
  onView: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onUpdateStatus: vi.fn(),
};

describe("TasksListCards", () => {
  it("renders module directory cards for tasks", () => {
    const html = renderToStaticMarkup(<TasksListCards {...baseProps} />);
    expect(html).toContain("module-cards");
    expect(html).toContain("Card Task");
  });

  it("shows trash empty state when archived list has no tasks", () => {
    const html = renderToStaticMarkup(
      <TasksListCards {...baseProps} tasks={[]} viewingDeleted={true} canWrite={false} />,
    );
    expect(html).toContain("tasks.trashEmptyTitle");
  });

  it("shows loading label while waiting for first page", () => {
    const html = renderToStaticMarkup(
      <TasksListCards {...baseProps} tasks={[]} isLoading={true} />,
    );
    expect(html).toContain("common.loading");
  });
});
