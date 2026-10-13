import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TaskRecord } from "@mms/shared";
import { TaskCardItem } from "./TaskCardItem";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useWorkCardAction", () => ({
  useWorkCardAction: () => ({
    isSelected: false,
    onSelect: vi.fn(),
    onView: vi.fn(),
    cardProps: { role: "article" as const },
  }),
}));

vi.mock("@/components/app/EntityCard", () => {
  const EntityCard = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  EntityCard.Header = ({ displayName }: { displayName: string }) => <div>{displayName}</div>;
  EntityCard.MetaGrid = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { EntityCard };
});

vi.mock("@/components/app/EntityCardMetaTile", () => ({
  EntityCardMetaTile: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/app/EntityCardFooterActions", () => ({
  EntityCardFooterActions: () => null,
}));

vi.mock("@/components/common/data-table", () => ({
  DataTableRowActions: () => null,
}));

const mockTask: TaskRecord = {
  id: "a0000000-0000-0000-0000-000000000001",
  workspaceSubdomain: "test",
  title: "Prepare Quran Syllabus",
  description: "Update the Tajweed requirements for Semester 1",
  status: "todo",
  priority: "high",
  dueAt: "2026-11-01T10:00:00.000Z",
  createdById: null,
  creatorName: "Admin",
  parentTaskId: null,
  assignees: [
    {
      id: "b0000000-0000-0000-0000-000000000001",
      taskId: "a0000000-0000-0000-0000-000000000001",
      facultyId: "fac-1",
      userId: "c0000000-0000-0000-0000-000000000001",
      facultyName: "Sheikh Ahmad",
    },
  ],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
};

describe("TaskCardItem", () => {
  it("renders task title and assignee names", () => {
    const html = renderToStaticMarkup(
      <TaskCardItem
        task={mockTask}
        selectedIds={[]}
        viewingDeleted={false}
        canWrite={true}
        canDelete={true}
        isColumnVisible={() => true}
        onToggleSelected={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onUpdateStatus={vi.fn()}
      />,
    );
    expect(html).toContain("Prepare Quran Syllabus");
    expect(html).toContain("Sheikh Ahmad");
    expect(html).toContain("tasks.status.todo");
  });
});
