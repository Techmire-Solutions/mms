import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withTenant: vi.fn(),
  recordModernAuditEvent: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("../db/tenant-context.js", () => ({ withTenant: mocks.withTenant }));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.recordModernAuditEvent,
}));
vi.mock("../db/dbConnection.js", () => ({
  activeDb: () => ({ select: mocks.select, update: mocks.update, insert: mocks.insert }),
}));

import { executeSubjectErasure } from "../services/cryptoShreddingService.js";

const erasure = {
  subjectId: "sub-1",
  workspaceSubdomain: "demo",
  regime: "GDPR" as const,
  erasureType: "CRYPTO_SHRED" as const,
  requestedBy: "admin-1",
};

describe("crypto-shredding audit event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTenant.mockImplementation(async (_tenant: string, callback: () => Promise<unknown>) =>
      callback(),
    );
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({ limit: async () => [{ id: "key-1", status: "ACTIVE" }] }),
      }),
    });
    mocks.update.mockReturnValue({ set: () => ({ where: async () => undefined }) });
    mocks.insert.mockReturnValue({ values: async () => undefined });
    mocks.recordModernAuditEvent.mockResolvedValue(undefined);
  });

  it("passes the subject id so the erasure states are subject-encrypted", async () => {
    const result = await executeSubjectErasure(erasure);

    expect(result.status).toBe("COMPLETED");
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "crypto_shredding_keys",
        recordId: "sub-1",
        actionType: "DELETE",
        subjectId: "sub-1",
        oldState: { subjectId: "sub-1", status: "ACTIVE" },
        newState: expect.objectContaining({ subjectId: "sub-1", status: "SHREDDED" }),
      }),
    );
  });

  it("emits no audit event when there is no key to shred", async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });

    const result = await executeSubjectErasure(erasure);

    expect(result.status).toBe("NO_KEY");
    expect(mocks.recordModernAuditEvent).not.toHaveBeenCalled();
  });
});
