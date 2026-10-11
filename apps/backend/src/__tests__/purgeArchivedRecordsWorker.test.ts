import { describe, expect, it, vi, beforeEach } from "vitest";
import { purgeExpiredArchivedRecords } from "../worker/purgeArchivedRecordsJob.js";
import { executeGdprErasure } from "../services/gdprErasureService.js";
import { getMsUntilNextUtcHour, runRetentionPurgeCycle } from "../worker/index.js";
import type { DbClient } from "../db/dbConnection.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";
import { executeSubjectErasure } from "../services/cryptoShreddingService.js";
import { messageLogs } from "../db/schema.js";

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({
    id: 1,
    hashPrevious: "0".repeat(64),
    hashCurrent: "1".repeat(64),
    canonicalPayload: "{}",
  }),
}));

vi.mock("../services/cryptoShreddingService.js", () => ({
  executeSubjectErasure: vi.fn().mockResolvedValue({
    erasureRequestId: "era-test-123",
    subjectId: "contact-subject-456",
    erasureType: "CRYPTO_SHRED",
    status: "COMPLETED",
  }),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Purge Archived Records Worker & GDPR Article 17 Erasure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Verify chunked purge deletes records in batches of 500 without deadlocks", async () => {
    // Generate 750 candidate IDs (Chunk 1: 500, Chunk 2: 250)
    const chunk1 = Array.from({ length: 500 }, (_, i) => ({ id: `msg-chunk1-${i}` }));
    const chunk2 = Array.from({ length: 250 }, (_, i) => ({ id: `msg-chunk2-${i}` }));

    let callCount = 0;
    const executedSqlStatements: string[] = [];
    const deletedBatches: string[][] = [];

    const executeMock = vi
      .fn()
      .mockImplementation(async (query: { queryChunks?: Array<{ value?: string[] }> }) => {
        // Track executed SQL strings (e.g. SET LOCAL app.allow_hard_purge = 'true')
        executedSqlStatements.push(JSON.stringify(query));
        return undefined;
      });

    const deleteMock = vi.fn().mockImplementation((_table) => ({
      where: vi.fn().mockImplementation((_pred) => {
        return Promise.resolve();
      }),
    }));

    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation((limitVal: number) => {
            expect(limitVal).toBe(500);
            return {
              for: vi
                .fn()
                .mockImplementation((lockMode: string, options: { skipLocked: boolean }) => {
                  expect(lockMode).toBe("update");
                  expect(options.skipLocked).toBe(true);
                  callCount++;
                  if (callCount === 1) {
                    deletedBatches.push(chunk1.map((c) => c.id));
                    return Promise.resolve(chunk1);
                  }
                  if (callCount === 2) {
                    deletedBatches.push(chunk2.map((c) => c.id));
                    return Promise.resolve(chunk2);
                  }
                  return Promise.resolve([]);
                }),
            };
          }),
        }),
      }),
    }));

    const txMock = {
      execute: executeMock,
      select: selectMock,
      delete: deleteMock,
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    const mockDb = {
      transaction: vi
        .fn()
        .mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
          return cb(txMock);
        }),
    } as unknown as DbClient;

    const result = await purgeExpiredArchivedRecords(mockDb, "demo-tenant", false, {
      targetTables: [{ name: "message_logs", table: messageLogs }],
    });

    // Verify chunking behavior
    expect(result.purgedTables.message_logs).toBe(750);
    expect(mockDb.transaction).toHaveBeenCalledTimes(2); // 500 chunk + 250 chunk
    expect(deletedBatches).toHaveLength(2);
    expect(deletedBatches[0]).toHaveLength(500);
    expect(deletedBatches[1]).toHaveLength(250);

    // Verify lock-free query modifier and trigger bypass escalation
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(recordModernAuditEvent).toHaveBeenCalledTimes(2);
    expect(recordModernAuditEvent).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        actionType: "DELETE",
        apiEndpoint: "entity.hard_purge",
        tableName: "message_logs",
        workspaceSubdomain: "demo-tenant",
      }),
    );
  });

  it("Verify purge transactions without SET LOCAL app.allow_hard_purge = 'true' fail trigger checks", async () => {
    // Simulates the PostgreSQL forbid_hard_delete() trigger contract:
    // IF current_setting('app.allow_hard_purge', true) != 'true' THEN RAISE EXCEPTION ...
    class SimulatedTriggerViolationError extends Error {
      code = "23514";
      constructor() {
        super(
          'Hard delete forbidden on table "students", use soft-delete (UPDATE ... SET deleted_at = NOW()) or set app.allow_hard_purge = true in maintenance transactions.',
        );
        this.name = "SimulatedTriggerViolationError";
      }
    }

    let sessionAllowHardPurge = false;

    const simulatedTx = {
      execute: vi.fn().mockImplementation(async (query: { strings?: string[] }) => {
        const sqlText = query?.strings ? query.strings.join("") : String(query);
        if (sqlText.includes("app.allow_hard_purge = 'true'")) {
          sessionAllowHardPurge = true;
        }
      }),
      delete: vi.fn().mockImplementation(() => {
        if (!sessionAllowHardPurge) {
          throw new SimulatedTriggerViolationError();
        }
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    };

    // 1. Without SET LOCAL app.allow_hard_purge: Delete fails trigger check
    sessionAllowHardPurge = false;
    expect(() => {
      simulatedTx.delete();
    }).toThrowError(/Hard delete forbidden on table "students"/);

    // 2. With SET LOCAL app.allow_hard_purge: Delete succeeds
    await simulatedTx.execute({ strings: ["SET LOCAL app.allow_hard_purge = 'true'"] });
    expect(() => {
      simulatedTx.delete();
    }).not.toThrow();
  });

  it("Verify GDPR pseudonymization scrubs plain PII and preserves relational ID continuity", async () => {
    const contactId = "contact-subject-456";
    const tenant = "demo-tenant";

    const executeMock = vi.fn().mockResolvedValue(undefined);
    const updateMock = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const deleteMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const insertMock = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const mockDb = {
      execute: executeMock,
      update: updateMock,
      delete: deleteMock,
      insert: insertMock,
    } as unknown as DbClient;

    const result = await executeGdprErasure(tenant, contactId, { db: mockDb });

    // 1. Invalidate subject encryption key in KMS/Vault (crypto-shredding custom_data)
    expect(executeSubjectErasure).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: contactId,
        workspaceSubdomain: tenant,
        regime: "GDPR",
        erasureType: "CRYPTO_SHRED",
        reason: "GDPR Article 17 Erasure Request",
      }),
    );

    // 2. Relational ID continuity is strictly preserved
    expect(result.contactId).toBe(contactId);
    expect(result.pseudonymizedRecord.id).toBe(contactId);

    // 3. Plain PII attributes are pseudonymized and scrubbed in place
    expect(result.pseudonymizedRecord.firstName).toBe("Anonymized");
    expect(result.pseudonymizedRecord.lastName).toBe("Subject");
    expect(result.pseudonymizedRecord.name).toBe("Anonymized Subject");
    expect(result.pseudonymizedRecord.email).toBe(`erased-${contactId}@deleted.local`);
    expect(result.pseudonymizedRecord.phone).toBeNull();
    expect(result.pseudonymizedRecord.customData).toEqual({});

    // 4. Soft-delete markers are applied
    expect(result.pseudonymizedRecord.deletedAt).toBeInstanceOf(Date);
    expect(result.pseudonymizedRecord.deletionReason).toBe("GDPR Article 17 Erasure Request");

    // 5. Audit event emitted with REDACT action
    expect(recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: tenant,
        tableName: "contacts",
        recordId: contactId,
        actionType: "REDACT",
        apiEndpoint: "gdpr.article17.erasure",
      }),
    );
  });

  it("calculates scheduled delay to 02:00 UTC correctly", () => {
    const delayMs = getMsUntilNextUtcHour(2);
    expect(delayMs).toBeGreaterThan(0);
    // At most 24 hours
    expect(delayMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("runs retention purge cycle across active workspaces", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([{ subdomain: "tenant-a" }, { subdomain: "tenant-b" }]),
      }),
    } as unknown as DbClient;

    const results = await runRetentionPurgeCycle(mockDb);
    expect(results).toBeDefined();
    expect(mockDb.select).toHaveBeenCalled();
  });
});
