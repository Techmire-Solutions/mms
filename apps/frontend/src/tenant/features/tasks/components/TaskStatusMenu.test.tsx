import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TaskRecord } from "@mms/shared";
import { TaskStatusMenu } from "./TaskStatusMenu";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
    expect(html).toContain('aria-label="tasks.changeStatusFor"');
  });

  it("does not activate the surrounding row when the status menu is opened", async () => {
    const onRowClick = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <div onClick={onRowClick}>
          <TaskStatusMenu task={task} canChange onChangeStatus={vi.fn()} />
        </div>,
      );
    });

    const trigger = container.querySelector('button[aria-label="tasks.changeStatusFor"]');
    expect(trigger).not.toBeNull();
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRowClick).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders only the badge for read-only viewers", () => {
    const html = renderToStaticMarkup(
      <TaskStatusMenu task={task} canChange={false} onChangeStatus={vi.fn()} />,
    );

    expect(html).toContain("tasks.status.todo");
    expect(html).not.toContain("tasks.changeStatusFor");
  });
});
