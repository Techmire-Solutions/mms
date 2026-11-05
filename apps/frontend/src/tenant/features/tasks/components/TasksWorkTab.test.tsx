import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TaskRecord } from "@mms/shared";
import { TasksWorkTab } from "./TasksWorkTab";

const viewModeState = { viewMode: "table" as "table" | "cards" };

const mockBulkDelete = vi.fn();
const mockBulkRestore = vi.fn();
const mockBulkUpdateStatus = vi.fn();

vi.mock("@/tenant/hooks/collections/tasks", () => ({
  useTask: () => ({ data: undefined }),
  useBulkDeleteTasks: () => ({
    mutate: mockBulkDelete,
    isPending: false,
  }),
  useBulkRestoreTasks: () => ({
    mutate: mockBulkRestore,
    isPending: false,
  }),
  useBulkUpdateTaskStatus: () => ({
    mutate: mockBulkUpdateStatus,
    isPending: false,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    archivedWithUndo: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) =>
      params?.count !== undefined ? `${key}:${params.count}` : key,
  }),
}));

vi.mock("@/hooks/useWorkDirectoryViewMode", () => ({
  useWorkDirectoryViewMode: () => ({
    viewMode: viewModeState.viewMode,
    setViewMode: vi.fn(),
  }),
}));

vi.mock("../hooks/useTasksColumnLayout", () => ({
  useTasksColumnLayout: () => ({
    columnRegistry: [],
    isColumnVisible: () => true,
    getColumnWidth: () => undefined,
    setColumnWidth: vi.fn(),
    updateUserColumnLayout: vi.fn(),
    resetColumnLayout: vi.fn(),
    customizerLabels: {},
  }),
}));

vi.mock("./TasksWorkDirectory", () => ({
  TasksWorkDirectory: ({
    viewMode,
    tasks,
    emptyAction,
  }: {
    viewMode: string;
    tasks: TaskRecord[];
    emptyAction?: React.ReactNode;
  }) => (
    <div data-testid={`tasks-directory-${viewMode}`}>
      {tasks.map((task) => (
        <div key={task.id}>
          {task.title}
          <span>{`tasks.priority.${task.priority}`}</span>
          <span>{`tasks.status.${task.status}`}</span>
        </div>
      ))}
      {tasks.length === 0 ? (
        <div>
          <span>tasks.emptyTitle</span>
          {emptyAction}
        </div>
      ) : null}
    </div>
  ),
}));

vi.mock("./TaskDetailDrawer", () => ({
  TaskDetailDrawer: () => null,
}));

vi.mock("@/components/common/work/WorkTaskToolbar", () => ({
  WorkTaskToolbar: ({
    primaryAction,
    regionLabel,
    viewModeToggle,
    columnCustomizer,
    searchId,
  }: {
    primaryAction?: React.ReactNode;
    regionLabel: string;
    viewModeToggle?: { viewMode: string };
    columnCustomizer?: { registry?: unknown[] };
    searchId?: string;
  }) => (
    <div>
      <span>{regionLabel}</span>
      <span>{`viewMode:${viewModeToggle?.viewMode ?? "none"}`}</span>
      <span>{columnCustomizer ? "columns:ready" : "columns:missing"}</span>
      {searchId ? <span>{`searchId:${searchId}`}</span> : null}
      {primaryAction}
    </div>
  ),
}));

const mockTask: TaskRecord = {
  id: "a0000000-0000-0000-0000-000000000001",
  workspaceSubdomain: "test",
  title: "Review Midterm Exams",
  description: "Grading evaluation",
  status: "in_progress",
  priority: "urgent",
  dueAt: null,
  createdById: null,
  creatorName: "Admin",
  parentTaskId: null,
  assignees: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
};

const baseProps = {
  tasks: [mockTask],
  isLoading: false,
  canWrite: true,
  canDelete: true,
  selectedIds: [] as string[],
  onToggleSelected: vi.fn(),
  onToggleSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  onAddNew: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onUpdateStatus: vi.fn(),
  total: 1,
  pageIndex: 0,
  pageSize: 50,
  onPageChange: vi.fn(),
  onServerFiltersChange: vi.fn(),
};

describe("TasksWorkTab", () => {
  beforeEach(() => {
    viewModeState.viewMode = "table";
  });

  it("renders table directory with title, priority, and column customizer", () => {
    const html = renderToStaticMarkup(<TasksWorkTab {...baseProps} />);
    expect(html).toContain("Review Midterm Exams");
    expect(html).toContain("tasks.priority.urgent");
    expect(html).toContain("tasks.status.in_progress");
    expect(html).toContain("viewMode:table");
    expect(html).toContain("columns:ready");
    expect(html).toContain("tasks-directory-table");
  });

  it("renders empty directory when task list is empty", () => {
    const html = renderToStaticMarkup(<TasksWorkTab {...baseProps} tasks={[]} />);
    expect(html).toContain("tasks.emptyTitle");
  });

  it("offers an in-context create action when the directory is empty and writable", () => {
    const html = renderToStaticMarkup(<TasksWorkTab {...baseProps} tasks={[]} />);
    expect(html).toContain("tasks.create");
  });

  it("hides the create action for read-only users and in trash", () => {
    const readOnly = renderToStaticMarkup(
      <TasksWorkTab {...baseProps} tasks={[]} canWrite={false} />,
    );
    expect(readOnly).not.toContain("tasks.create");

    const trash = renderToStaticMarkup(<TasksWorkTab {...baseProps} tasks={[]} viewingDeleted />);
    expect(trash).not.toContain("tasks.create");
  });

  it("passes the stable search input id to the toolbar", () => {
    const html = renderToStaticMarkup(<TasksWorkTab {...baseProps} />);
    expect(html).toContain("searchId:tasks-work-search");
  });

  it("switches directory to cards when viewMode is cards", () => {
    viewModeState.viewMode = "cards";
    const html = renderToStaticMarkup(<TasksWorkTab {...baseProps} />);
    expect(html).toContain("tasks-directory-cards");
    expect(html).toContain("Review Midterm Exams");
  });

  it("renders bulk action bar when items are selected", () => {
    const html = renderToStaticMarkup(<TasksWorkTab {...baseProps} selectedIds={[mockTask.id]} />);
    expect(html).toContain("tasks.selectedCount:1");
  });
});
