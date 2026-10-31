import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskFormModal } from "./TaskFormModal";

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/tasks", () => ({
  useEligibleTaskAssignees: () => ({
    data: [
      {
        facultyId: "fac-1",
        name: "Ustadh Zaid",
        userId: "usr-1",
        isSelf: false,
      },
    ],
    isLoading: false,
  }),
  useTasks: () => ({
    data: { tasks: [{ id: "parent-1", title: "Parent task" }], total: 1 },
    isLoading: false,
  }),
}));

describe("TaskFormModal", () => {
  it("renders nothing when closed", () => {
    const html = renderToStaticMarkup(
      <TaskFormModal open={false} onClose={() => {}} onSave={async () => {}} />,
    );
    expect(html).toBe("");
  });

  it("renders form elements when open", () => {
    const html = renderToStaticMarkup(
      <TaskFormModal open={true} onClose={() => {}} onSave={async () => {}} />,
    );
    expect(html).toContain("tasks.create");
    expect(html).toContain("tasks.title");
    expect(html).toContain("tasks.startDate");
    expect(html).toContain("tasks.parentTask");
    expect(html).toContain("Ustadh Zaid");
  });

  it("renders edit mode with initial data", () => {
    const html = renderToStaticMarkup(
      <TaskFormModal
        open={true}
        onClose={() => {}}
        onSave={async () => {}}
        initialData={{
          id: "t-1",
          workspaceSubdomain: "demo",
          title: "Existing Task",
          status: "in_progress",
          priority: "high",
          assignees: [],
        }}
      />,
    );
    expect(html).toContain("tasks.edit");
    expect(html).toContain("Existing Task");
  });
});
