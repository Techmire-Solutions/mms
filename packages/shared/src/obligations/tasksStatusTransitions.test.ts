import { describe, expect, it } from "vitest";
import {
  TASK_STATUSES,
  TASK_STATUS_TRANSITIONS,
  isTaskStatusTransitionAllowed,
  taskStatusTransitionsFrom,
} from "./tasksModuleManifest.js";

describe("task status transitions", () => {
  it("defines a target list for every status", () => {
    for (const status of TASK_STATUSES) {
      expect(Array.isArray(taskStatusTransitionsFrom(status))).toBe(true);
    }
  });

  it("treats the same status as a no-op and rejects unknown edges", () => {
    for (const status of TASK_STATUSES) {
      expect(isTaskStatusTransitionAllowed(status, status)).toBe(true);
    }
    expect(isTaskStatusTransitionAllowed("completed", "todo")).toBe(false);
    expect(isTaskStatusTransitionAllowed("cancelled", "completed")).toBe(false);
    expect(TASK_STATUS_TRANSITIONS.completed).toEqual(["in_progress"]);
    expect(TASK_STATUS_TRANSITIONS.cancelled).toEqual(["todo"]);
  });

  it("does not gate a forward move through the workflow", () => {
    expect(isTaskStatusTransitionAllowed("todo", "in_progress")).toBe(true);
    expect(isTaskStatusTransitionAllowed("in_progress", "completed")).toBe(true);
    expect(isTaskStatusTransitionAllowed("in_review", "completed")).toBe(true);
    expect(isTaskStatusTransitionAllowed("blocked", "in_progress")).toBe(true);
  });
});
