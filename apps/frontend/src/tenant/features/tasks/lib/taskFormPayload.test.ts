import { describe, expect, it } from "vitest";
import type { TaskRecord } from "@mms/shared";
import { assigneesChanged, buildTaskFormPayload } from "./taskFormPayload";

const existing: TaskRecord = {
  id: "task-1",
  workspaceSubdomain: "demo",
  title: "Existing task",
  description: "desc",
  priority: "medium",
  status: "todo",
  startDate: null,
  dueAt: null,
  parentTaskId: null,
  assignees: [
    { id: "a-1", taskId: "task-1", facultyId: "fac-1", userId: "u-1", facultyName: "Zaid" },
    { id: "a-2", taskId: "task-1", facultyId: "fac-2", userId: "u-2", facultyName: "Amina" },
  ],
};

const baseInput = {
  title: "  Existing task  ",
  description: " desc ",
  priority: "medium" as const,
  status: "todo" as const,
  startDate: null,
  dueAt: null,
  parentTaskId: null,
  initialData: existing,
};

describe("buildTaskFormPayload", () => {
  it("omits assignees when an update leaves the set unchanged", () => {
    const payload = buildTaskFormPayload({
      ...baseInput,
      assignees: [{ facultyId: "fac-2" }, { facultyId: "fac-1" }],
    });

    expect(payload).not.toHaveProperty("assignees");
    expect(payload.title).toBe("Existing task");
  });

  it("sends assignees when the picker changed", () => {
    const payload = buildTaskFormPayload({
      ...baseInput,
      assignees: [{ facultyId: "fac-1" }],
    });

    expect(payload.assignees).toEqual([{ facultyId: "fac-1" }]);
  });

  it("always sends assignees on create", () => {
    const payload = buildTaskFormPayload({
      ...baseInput,
      initialData: null,
      title: "New task",
      assignees: [{ facultyId: "fac-1" }],
    });

    expect(assigneesChanged({ ...baseInput, initialData: null, assignees: [] })).toBe(true);
    expect(payload.assignees).toEqual([{ facultyId: "fac-1" }]);
  });
});
