/**
 * @file taskNotificationDeliveryService.test.ts
 * @description Unit coverage for the task notification delivery consumer (M4).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTenantTaskSettingsBySubdomain: vi.fn(),
  notify: vi.fn(),
  sendTenantEmail: vi.fn(),
  loadUserEmailsByTenant: vi.fn(),
}));

vi.mock("../services/taskSettingsService.js", () => ({
  getTenantTaskSettingsBySubdomain: (...args: unknown[]) =>
    mocks.getTenantTaskSettingsBySubdomain(...args),
}));
vi.mock("../notifications/use-cases/notificationsUseCases.js", () => ({
  notificationsUseCases: { notify: (...args: unknown[]) => mocks.notify(...args) },
}));
vi.mock("../services/email/emailService.js", () => ({
  sendTenantEmail: (...args: unknown[]) => mocks.sendTenantEmail(...args),
}));
vi.mock("../users/use-cases/usersUseCases.js", () => ({
  usersUseCases: {
    loadUserEmailsByTenant: (...args: unknown[]) => mocks.loadUserEmailsByTenant(...args),
  },
}));

import { deliverTaskNotification } from "../services/taskNotificationDeliveryService.js";

const settings = {
  delegationScope: "descendants" as const,
  allowSelfAssignment: true,
  notifyOnAssignment: true,
  notifyOnStatusChange: true,
  notificationChannel: "in_app" as const,
};

const payload = {
  entityType: "tasks" as const,
  entityId: "t1",
  tenantId: "demo",
  version: 1,
  recipientUserIds: ["u1", "u2"],
  actorUserId: "actor",
  reason: "assignment" as const,
  title: "Prepare report",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTenantTaskSettingsBySubdomain.mockResolvedValue(settings);
  mocks.notify.mockResolvedValue(true);
  mocks.sendTenantEmail.mockResolvedValue({ sent: true });
});

describe("deliverTaskNotification", () => {
  it("inserts an in-app notification for each recipient on assignment", async () => {
    await deliverTaskNotification("demo", payload);

    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ kind: "task_assigned", recipientUserId: "u1", entityId: "t1" }),
    );
  });

  it("skips delivery when the notify toggle is off", async () => {
    mocks.getTenantTaskSettingsBySubdomain.mockResolvedValue({
      ...settings,
      notifyOnAssignment: false,
    });

    await deliverTaskNotification("demo", payload);

    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("delivers a status-change notification to the creator kind", async () => {
    await deliverTaskNotification("demo", {
      ...payload,
      reason: "status_change",
      recipientUserIds: ["creator"],
    });

    expect(mocks.notify).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ kind: "task_status_changed", recipientUserId: "creator" }),
    );
  });

  it("sends an email for each recipient on the messaging channel", async () => {
    mocks.getTenantTaskSettingsBySubdomain.mockResolvedValue({
      ...settings,
      notificationChannel: "messaging",
    });
    mocks.loadUserEmailsByTenant.mockResolvedValue(["u1@example.test", "u2@example.test"]);

    await deliverTaskNotification("demo", payload);

    expect(mocks.loadUserEmailsByTenant).toHaveBeenCalledWith("demo", ["u1", "u2"]);
    expect(mocks.sendTenantEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendTenantEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "u1@example.test" }),
    );
  });
});
