import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_TASK_SETTINGS } from "@mms/shared";
import { TasksSetupTab } from "./TasksSetupTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/tasks", () => ({
  useTaskSettings: () => ({
    data: { ...DEFAULT_TASK_SETTINGS },
    isLoading: false,
  }),
  useUpdateTaskSettings: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("TasksSetupTab", () => {
  it("renders task settings configuration controls", () => {
    const html = renderToStaticMarkup(<TasksSetupTab />);
    expect(html).toContain("tasks.setup.delegationScope");
    expect(html).toContain("tasks.setup.allowSelfAssignment");
    expect(html).toContain("tasks.setup.notifyOnAssignment");
    expect(html).toContain("tasks.setup.notifyOnStatusChange");
  });
});
