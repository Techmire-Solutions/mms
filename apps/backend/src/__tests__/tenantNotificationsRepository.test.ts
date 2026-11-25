import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const onConflictDoNothing = vi.fn<() => unknown>(() => ({
    returning: vi.fn().mockResolvedValue([{ id: "notif-1" }]),
  }));
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values }));
  return {
    onConflictDoNothing,
    values,
    insert,
  };
});

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: (_tenant: string, fn: (tx: { insert: typeof mocks.insert }) => Promise<unknown>) =>
    fn({ insert: mocks.insert }),
  withTenantRead: vi.fn(),
}));

import { insertTenantNotification } from "../db/repositories/tenantNotificationsRepository.js";

describe("tenantNotificationsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts tenant notification with dedupeKey fallback", async () => {
    const inserted = await insertTenantNotification("test-subdomain", {
      id: "notif-1",
      kind: "task_assigned",
      audiencePermission: "tasks.view",
      entityType: "tasks",
      entityId: "task-100",
      subjectLabel: "Test Task",
      contextLabel: "Assigned to you",
      recipientUserId: "usr-1",
    });

    expect(inserted).toBe(true);
    expect(mocks.insert).toHaveBeenCalled();
  });
});
