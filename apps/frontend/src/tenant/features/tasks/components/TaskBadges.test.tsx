import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskBadges";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("TaskBadges", () => {
  it("given urgent priority, should render StatusBadge with destructive semantic tone", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<TaskPriorityBadge priority="urgent" />);

    // Assert
    expect(html).toContain("tasks.priority.urgent");
    expect(html).toContain(SEMANTIC_BADGE.destructive.split(" ")[0]);
  });

  it("given in_progress status, should render StatusBadge with info semantic tone", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<TaskStatusBadge status="in_progress" />);

    // Assert
    expect(html).toContain("tasks.status.in_progress");
    expect(html).toContain(SEMANTIC_BADGE.info.split(" ")[0]);
  });

  it("given status onClick, should render a button badge", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<TaskStatusBadge status="todo" onClick={() => undefined} />);

    // Assert
    expect(html).toContain("<button");
    expect(html).toContain("tasks.status.todo");
  });
});
