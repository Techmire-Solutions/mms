import { describe, expect, it, vi } from "vitest";
import { purgeExpiredArchivedRecords } from "../worker/purgeArchivedRecordsJob.js";
import type { DbClient } from "../db/dbConnection.js";

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({
    id: 1,
    hashPrevious: "0".repeat(64),
    hashCurrent: "1".repeat(64),
    canonicalPayload: "{}",
  }),
}));

describe("purgeExpiredArchivedRecords background job", () => {
  it("calculates counts without deleting when dryRun is true", async () => {
    const txMock = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 42 }]),
        }),
      }),
    };

    const mockDb = {
      transaction: vi
        .fn()
        .mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
    } as unknown as DbClient;

    const result = await purgeExpiredArchivedRecords(mockDb, "demo", true);

    expect(result.purgedTables.message_logs).toBe(42);
    expect(result.purgedTables.attendance).toBe(42);
    expect(mockDb.transaction).toHaveBeenCalledTimes(2);
    // Tenant/purge GUCs must be applied before the archived-row count is read.
    expect(txMock.execute).toHaveBeenCalledTimes(2);
  });

  it("executes chunked deletions with app.allow_hard_purge escalation and audit emission when dryRun is false", async () => {
    const executeMock = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const selectMock = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            for: vi.fn().mockResolvedValue([{ id: "row-1" }, { id: "row-2" }]),
          }),
        }),
      }),
    });

    const txMock = {
      execute: executeMock,
      select: selectMock,
      delete: deleteMock,
    };

    const mockDb = {
      transaction: vi
        .fn()
        .mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
          return cb(txMock);
        }),
    } as unknown as DbClient;

    const result = await purgeExpiredArchivedRecords(mockDb, "demo", false);

    expect(result.purgedTables.message_logs).toBe(2);
    expect(result.purgedTables.attendance).toBe(2);
    expect(executeMock).toHaveBeenCalledWith(expect.anything());
    expect(deleteMock).toHaveBeenCalled();
  });
});
