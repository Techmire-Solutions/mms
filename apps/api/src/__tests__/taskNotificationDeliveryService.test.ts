/**
 * @file taskNotificationDeliveryService.test.ts
 * @description Unit coverage for the task notification delivery consumer (M4).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTenantTaskSettingsBySubdomain: vi.fn(),
  notify: vi.fn(),
  loadUserEmailsByTenant: vi.fn(),
  loadUserContactIdsByTenant: vi.fn(),
  loadContactsSummaryByIdsForTenant: vi.fn(),
  loadMessagingPreferences: vi.fn(),
  dispatchMessagingCampaignDirect: vi.fn(),
}));

vi.mock("../services/taskSettingsService.js", () => ({
  getTenantTaskSettingsBySubdomain: (...args: unknown[]) =>
    mocks.getTenantTaskSettingsBySubdomain(...args),
  getWorkspaceLanguage: () => "en",
}));
vi.mock("@mms/mod-notifications/backend/use-cases", () => ({
  notificationsUseCases: { notify: (...args: unknown[]) => mocks.notify(...args) },
}));
vi.mock("../users/use-cases/usersUseCases.js", () => ({
  usersUseCases: {
    loadUserEmailsByTenant: (...args: unknown[]) => mocks.loadUserEmailsByTenant(...args),
    loadUserContactIdsByTenant: (...args: unknown[]) => mocks.loadUserContactIdsByTenant(...args),
  },
}));
vi.mock("@mms/mod-contacts/backend/use-cases", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-contacts/backend/use-cases")>()),
  ...{
    loadContactsSummaryByIdsForTenant: (...args: unknown[]) =>
      mocks.loadContactsSummaryByIdsForTenant(...args),
  },
}));

vi.mock("@mms/mod-contacts/backend/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-contacts/backend/services")>()),
  ...{
    loadContactsSummaryByIdsForTenant: (...args: unknown[]) =>
      mocks.loadContactsSummaryByIdsForTenant(...args),
  },
}));
vi.mock("@mms/mod-messaging/backend/use-cases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/mod-messaging/backend/use-cases")>();
  return {
    ...actual,
    messagingUseCases: {
      ...actual.messagingUseCases,
      loadMessagingPreferences: (...args: unknown[]) => mocks.loadMessagingPreferences(...args),
    },
  };
});
vi.mock("@mms/mod-messaging/backend/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/mod-messaging/backend/services")>();
  return {
    ...actual,
    dispatchMessagingCampaignDirect: (...args: unknown[]) =>
      mocks.dispatchMessagingCampaignDirect(...args),
  };
});
vi.mock("../lib/logger.js", () => ({ logger: { warn: vi.fn() } }));

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
  mocks.loadUserEmailsByTenant.mockResolvedValue(new Map());
  mocks.loadUserContactIdsByTenant.mockResolvedValue(new Map());
  mocks.loadContactsSummaryByIdsForTenant.mockResolvedValue([]);
  mocks.loadMessagingPreferences.mockResolvedValue(null);
  mocks.dispatchMessagingCampaignDirect.mockResolvedValue({
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    total: 0,
  });
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

  it("dispatches messaging via the tenant default channel with an email fallback", async () => {
    mocks.getTenantTaskSettingsBySubdomain.mockResolvedValue({
      ...settings,
      notificationChannel: "messaging",
    });
    mocks.loadUserEmailsByTenant.mockResolvedValue(
      new Map([
        ["u1", "u1@example.test"],
        ["u2", "u2@example.test"],
      ]),
    );

    await deliverTaskNotification("demo", payload);

    expect(mocks.loadUserContactIdsByTenant).toHaveBeenCalledWith("demo", ["u1", "u2"]);
    expect(mocks.dispatchMessagingCampaignDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantSubdomain: "demo",
        channel: "sms",
        recipients: [
          { id: "u1", email: "u1@example.test" },
          { id: "u2", email: "u2@example.test" },
        ],
        message: expect.stringContaining("Prepare report"),
        category: "general",
      }),
    );
  });
});
