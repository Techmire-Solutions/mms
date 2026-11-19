import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskRecord } from "@mms/shared";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  onSave: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en" }),
}));
vi.mock("@/tenant/hooks/collections/tasks", () => ({
  useEligibleTaskAssignees: () => ({ data: [] }),
  useTasks: () => ({ data: { tasks: [] } }),
}));

import { useTaskFormController } from "./useTaskFormController";

const task: TaskRecord = {
  id: "t1",
  workspaceSubdomain: "demo",
  title: "Prepare report",
  description: "Details",
  status: "todo",
  priority: "medium",
  startDate: null,
  dueAt: null,
  parentTaskId: null,
  createdById: "owner-1",
  assignees: [{ id: "a1", taskId: "t1", facultyId: "f1", userId: "u1" }],
};

function renderController() {
  let latest: ReturnType<typeof useTaskFormController>;
  const rootEl = document.createElement("div");
  document.body.appendChild(rootEl);
  const root: Root = createRoot(rootEl);

  const Harness = () => {
    latest = useTaskFormController({
      open: true,
      onClose: () => {},
      initialData: task,
      onSave: mocks.onSave,
    });
    return null;
  };

  act(() => root.render(<Harness />));
  return {
    get: () => latest,
    root,
    rootEl,
    cleanup: () => {
      act(() => root.unmount());
      rootEl.remove();
    },
  };
}

describe("useTaskFormController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onSave.mockResolvedValue(undefined);
  });

  it("omits assignees from the payload on a title-only edit (F1)", async () => {
    const { get, cleanup } = renderController();

    act(() => get().setTitle("Renamed report"));

    await act(async () => {
      await get().handleSubmit();
    });

    expect(mocks.onSave).toHaveBeenCalledTimes(1);
    const body = mocks.onSave.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.title).toBe("Renamed report");
    expect("assignees" in body).toBe(false);

    cleanup();
  });
});
