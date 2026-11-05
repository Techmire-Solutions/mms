import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_TASK_SETTINGS } from "@mms/shared";
import { TasksSetupTab } from "./TasksSetupTab";

const state = { isError: false };

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/tasks", () => ({
  useTaskSettings: () => ({
    data: state.isError ? undefined : { ...DEFAULT_TASK_SETTINGS },
    isLoading: false,
    isError: state.isError,
    refetch: vi.fn(),
  }),
  useUpdateTaskSettings: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("TasksSetupTab", () => {
  afterEach(() => {
    state.isError = false;
  });

  it("disables editing and offers retry when preferences fail to load", () => {
    state.isError = true;
    const html = renderToStaticMarkup(<TasksSetupTab />);
    expect(html).toContain("tasks.setup.loadFailed");
    expect(html).toContain("common.tryAgain");
    expect(html).not.toContain("tasks.setup.delegationScope");
  });

  it("renders task settings configuration controls", () => {
    const html = renderToStaticMarkup(<TasksSetupTab />);
    expect(html).toContain("tasks.setup.delegationScope");
    expect(html).toContain("tasks.setup.allowSelfAssignment");
    expect(html).toContain("tasks.setup.notifyOnAssignment");
    expect(html).toContain("tasks.setup.notifyOnStatusChange");
  });
});
