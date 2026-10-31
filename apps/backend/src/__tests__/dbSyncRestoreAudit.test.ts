import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withTenant: vi.fn(),
  synchronizeData: vi.fn(),
  recordModernAuditEvent: vi.fn(),
}));

vi.mock("../db/tenant-context.js", () => ({ withTenant: mocks.withTenant }));
vi.mock("../services/dbSyncService.js", () => ({
  synchronizeData: mocks.synchronizeData,
  resetToDefaults: vi.fn(),
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.recordModernAuditEvent,
}));

import { restoreWorkspaceWithAudit } from "../services/dbSyncRestoreAudit.js";
import { SYNC_REQUEST_TIMEOUT_MS } from "../lib/syncLimits.js";

const payload = {
  collections: { students: [], contacts: [] },
  objects: { global_settings: {} },
};

describe("workspace restore audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTenant.mockImplementation(async (_tenant: string, callback: () => Promise<void>) =>
      callback(),
    );
    mocks.synchronizeData.mockResolvedValue(undefined);
    mocks.recordModernAuditEvent.mockResolvedValue(undefined);
  });

  it("runs the restore and its audit inside one tenant transaction", async () => {
    const order: string[] = [];
    mocks.synchronizeData.mockImplementation(async () => {
      order.push("restore");
    });
    mocks.recordModernAuditEvent.mockImplementation(async () => {
      order.push("audit");
    });

    await restoreWorkspaceWithAudit({
      tenant: "demo",
      payload: payload as never,
      actorUserId: "u-1",
    });

    expect(mocks.withTenant).toHaveBeenCalledWith("demo", expect.any(Function), {
      statementTimeoutMs: SYNC_REQUEST_TIMEOUT_MS,
    });
    expect(mocks.synchronizeData).toHaveBeenCalledWith(payload, undefined, true);
    expect(order).toEqual(["restore", "audit"]);
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "sync",
        recordId: "sync",
        actionType: "RESTORE",
        realUserId: "u-1",
        newState: {
          summary: "Restored workspace backup with 2 collections and 1 objects",
        },
      }),
    );
  });

  it("propagates an audit failure so the restore transaction rolls back", async () => {
    mocks.recordModernAuditEvent.mockRejectedValue(new Error("audit unavailable"));

    await expect(
      restoreWorkspaceWithAudit({
        tenant: "demo",
        payload: payload as never,
        actorUserId: "u-1",
      }),
    ).rejects.toThrow(/audit unavailable/);

    expect(mocks.synchronizeData).toHaveBeenCalledTimes(1);
  });
});
