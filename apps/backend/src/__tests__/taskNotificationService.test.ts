import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskRecord, TaskSettings } from "@mms/shared";

const emitOutboxEvent = vi.fn();
const withTenant = vi.fn(async (_tenant: string, fn: (tx: unknown) => Promise<void>) => fn({}));

vi.mock("../services/outboxEventService.js", () => ({ emitOutboxEvent }));
vi.mock("../db/tenant-context.js", () => ({ withTenant }));

const { emitTaskNotificationIntents } = await import("../services/taskNotificationService.js");

const baseSettings: TaskSettings = {
  delegationScope: "descendants",
  allowSelfAssignment: true,
  notifyOnAssignment: true,
  notifyOnStatusChange: true,
};

function task(partial: Partial<TaskRecord>): TaskRecord {
  return {
    id: "t1",
    workspaceSubdomain: "demo",
    title: "Demo",
    status: "todo",
    priority: "medium",
    createdById: "creator",
    assignees: [],
    ...partial,
  };
}

describe("emitTaskNotificationIntents", () => {
  beforeEach(() => {
    emitOutboxEvent.mockReset();
    withTenant.mockClear();
  });

  it("given new assignees and notifyOnAssignment, should emit task.assigned", async () => {
    await emitTaskNotificationIntents({
      tenant: "demo",
      settings: baseSettings,
      actorUserId: "actor",
      previous: task({ assignees: [] }),
      next: task({
        assignees: [{ id: "a1", taskId: "t1", facultyId: "f1", userId: "u1" }],
      }),
    });

    expect(emitOutboxEvent).toHaveBeenCalledWith(
      expect.anything(),
      "task.assigned",
      expect.objectContaining({
        recipientUserIds: ["u1"],
        reason: "assignment",
      }),
    );
  });

  it("given notify prefs off, should emit nothing", async () => {
    await emitTaskNotificationIntents({
      tenant: "demo",
      settings: { ...baseSettings, notifyOnAssignment: false, notifyOnStatusChange: false },
      actorUserId: "actor",
      previous: task({ status: "todo" }),
      next: task({
        status: "completed",
        assignees: [{ id: "a1", taskId: "t1", facultyId: "f1", userId: "u1" }],
      }),
    });

    expect(emitOutboxEvent).not.toHaveBeenCalled();
  });

  it("given status change and notifyOnStatusChange, should emit task.status_changed to creator", async () => {
    await emitTaskNotificationIntents({
      tenant: "demo",
      settings: { ...baseSettings, notifyOnAssignment: false },
      actorUserId: "actor",
      previous: task({ status: "todo" }),
      next: task({ status: "in_progress" }),
    });

    expect(emitOutboxEvent).toHaveBeenCalledWith(
      expect.anything(),
      "task.status_changed",
      expect.objectContaining({
        recipientUserIds: ["creator"],
        reason: "status_change",
      }),
    );
  });
});
