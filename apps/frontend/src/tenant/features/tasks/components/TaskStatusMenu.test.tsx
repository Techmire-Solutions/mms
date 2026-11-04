import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TaskRecord } from "@mms/shared";
import { TaskStatusMenu } from "./TaskStatusMenu";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const task: TaskRecord = {
  id: "task-1",
  workspaceSubdomain: "demo",
  title: "Prepare report",
  status: "todo",
  priority: "medium",
  assignees: [],
};

describe("TaskStatusMenu", () => {
  it("renders a change-status trigger next to the badge when the user may change it", () => {
    const html = renderToStaticMarkup(
      <TaskStatusMenu task={task} canChange onChangeStatus={vi.fn()} />,
    );

    expect(html).toContain("tasks.status.todo");
    expect(html).toContain('aria-label="tasks.bulkStatus"');
  });

  it("renders only the badge for read-only viewers", () => {
    const html = renderToStaticMarkup(
      <TaskStatusMenu task={task} canChange={false} onChangeStatus={vi.fn()} />,
    );

    expect(html).toContain("tasks.status.todo");
    expect(html).not.toContain("tasks.bulkStatus");
  });
});
