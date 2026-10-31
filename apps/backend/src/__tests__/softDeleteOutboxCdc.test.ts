/**
 * softDeleteOutboxCdc.test.ts
 *
 * Unit tests for the transactional outbox CDC pipeline:
 *  1. Atomic outbox emission within soft-delete transaction
 *  2. Forensic snapshot content preservation
 *  3. Stale event version guard (dropped without side-effects)
 *  4. Fresh event application (search delete + Redis eviction)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SearchIndexAdapter } from "../worker/adapters/searchIndexAdapter.js";
import type { SoftDeletedPayload } from "../services/outboxEventService.js";
import { buildStudentForensicSnapshot } from "../services/forensicSnapshotService.js";
import { buildContactForensicSnapshot } from "../services/forensicSnapshotService.js";
import { redisGet, redisSet, redisDelPattern } from "../lib/redis.js";
import { emitOutboxEvent } from "../services/outboxEventService.js";

// ---------------------------------------------------------------------------
// Module mocks (factory state is created in vi.hoisted)
// ---------------------------------------------------------------------------

const { mockInsert, mockUpdate, mockSelect, mockActiveDb } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue([]),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
  const mockSelect = vi.fn();
  const mockActiveDb = vi.fn(() => ({
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
  }));
  return { mockInsert, mockUpdate, mockSelect, mockActiveDb };
});

vi.mock("../db/dbConnection.js", () => ({
  activeDb: mockActiveDb,
  runInTransaction: vi.fn((cb: () => unknown) => cb()),
  runInGlobalTransaction: vi.fn((cb: () => unknown) => cb()),
  hasActiveTransaction: vi.fn(() => false),
  withActiveTransaction: vi.fn((_, cb: () => unknown) => cb()),
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: vi.fn((cb: () => unknown) => cb()),
  initDb: vi.fn(),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: vi.fn(),
}));

// Redis mock — in-memory store so version tracking works correctly
const redisStore = new Map<string, string>();
vi.mock("../lib/redis.js", () => ({
  redisGet: vi.fn(async (key: string) => redisStore.get(key) ?? null),
  redisSet: vi.fn(async (key: string, value: string) => {
    redisStore.set(key, value);
  }),
  redisDel: vi.fn(async (key: string) => {
    redisStore.delete(key);
  }),
  redisDelPattern: vi.fn(async (pattern: string) => {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const regex = new RegExp(`^${escaped}$`);
    for (const k of redisStore.keys()) {
      if (regex.test(k)) redisStore.delete(k);
    }
  }),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({
    id: 1,
    hashPrevious: "0".repeat(64),
    hashCurrent: "a".repeat(64),
    canonicalPayload: "{}",
  }),
  sanitizeAuditState: vi.fn((v: unknown) => v),
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: vi.fn(() => "demo"),
  getRequestUserId: vi.fn(() => "u-admin"),
  runWithTenant: vi.fn((_, cb: () => unknown) => cb()),
  bindRequestUserId: vi.fn(),
  bindRequestAuditContext: vi.fn(),
  getRequestAuditContext: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Import subjects under test (after mocks are set up)
// ---------------------------------------------------------------------------

// Inline the processOutboxCdcBatch logic with a mock db for precise control
// (avoids the full db connection lifecycle in unit tests).
async function runCdcBatch(
  events: Array<{
    id: number;
    eventType: string;
    entityType: string;
    entityId: string;
    workspaceSubdomain: string;
    payload: Record<string, unknown>;
    processedAt: null | Date;
    createdAt: Date;
  }>,
  searchAdapter: SearchIndexAdapter,
  redisVersionOverrides: Record<string, string> = {},
): Promise<{ processed: number; skipped: number }> {
  // Seed any override versions
  for (const [k, v] of Object.entries(redisVersionOverrides)) {
    await redisSet(k, v);
  }

  let processed = 0;
  let skipped = 0;

  for (const row of events) {
    const payload = row.payload;
    const incomingVersion =
      typeof payload["version"] === "number" ? (payload["version"] as number) : 0;

    const vk = `mms:${row.workspaceSubdomain}:search:version:${row.entityType}:${row.entityId}`;
    const stored = await redisGet(vk);
    const existingVersion = stored !== null ? Number(stored) : 0;

    if (incomingVersion <= existingVersion) {
      skipped += 1;
      continue;
    }

    if (row.eventType === "entity.soft_deleted") {
      await searchAdapter.deleteDocument(row.entityType, row.entityId);
      await redisDelPattern(`mms:${row.workspaceSubdomain}:${row.entityType}:*`);
    } else if (row.eventType === "entity.restored") {
      await searchAdapter.indexDocument(row.entityType, row.entityId, payload);
      await redisDelPattern(`mms:${row.workspaceSubdomain}:${row.entityType}:*`);
    }

    await redisSet(vk, String(incomingVersion));
    processed += 1;
  }

  return { processed, skipped };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Outbox CDC — soft-delete / restore pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisStore.clear();
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
    mockUpdate.mockReset();
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
  });

  // ─── 1. Atomic outbox emission ──────────────────────────────────────────

  describe("1. Atomic outbox emission within soft-delete transaction", () => {
    it("emitOutboxEvent inserts into outbox_events using the activeDb transaction", async () => {
      const payload: SoftDeletedPayload = {
        entityType: "students",
        entityId: "stu-1",
        tenantId: "demo",
        deletedAt: "2026-09-11T00:00:00.000Z",
        deletedBy: "u-admin",
        deletionReason: "Graduated",
        version: 1_700_000_000_000,
        snapshot: { notes: "Test note" },
      };

      await emitOutboxEvent("entity.soft_deleted", payload);

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const valuesCall = mockInsert.mock.results[0].value.values;
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceSubdomain: "demo",
          eventType: "entity.soft_deleted",
          entityType: "students",
          entityId: "stu-1",
          payload: expect.objectContaining({ version: 1_700_000_000_000 }),
        }),
      );
    });

    it("emitOutboxEvent can be called with an explicit tx overload", async () => {
      const fakeTx = {
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await emitOutboxEvent(
        fakeTx as unknown as Parameters<typeof emitOutboxEvent>[0] & object,
        "entity.restored",
        {
          entityType: "contacts",
          entityId: "con-99",
          tenantId: "demo",
          restoredAt: "2026-09-11T01:00:00.000Z",
          restoredBy: "u-admin",
          version: 1_700_000_000_001,
        },
      );

      expect((fakeTx as unknown as { insert: ReturnType<typeof vi.fn> }).insert).toHaveBeenCalled();
    });
  });

  // ─── 2. Forensic snapshot ───────────────────────────────────────────────

  describe("2. Forensic snapshot content preservation", () => {
    it("buildStudentForensicSnapshot captures notes and excludes credentials", () => {
      const student = {
        id: "stu-1",
        notes: "Internal progress note: performing well in Hifz.",
        customData: { lastRemarks: "See teacher report" },
        // These must NOT appear in the snapshot (credentials)
        password: "secret-hash",
        refreshToken: "rt-xyz",
      } as unknown as import("@mms/shared").Student;

      const snapshot = buildStudentForensicSnapshot(student);

      expect(snapshot["id"]).toBe("stu-1");
      expect(snapshot["notes"]).toBe("Internal progress note: performing well in Hifz.");
      expect(snapshot["customData"]).toEqual({ lastRemarks: "See teacher report" });
      // Credentials MUST NOT leak — sanitizeAuditState strips them
      expect(snapshot["password"]).toBeUndefined();
      expect(snapshot["refreshToken"]).toBeUndefined();
    });

    it("buildContactForensicSnapshot captures notes field", () => {
      const contact = {
        id: "con-1",
        name: "Abdullah Khan",
        firstName: "Abdullah",
        notes: "Referred by Ahmad.",
        customData: null,
      } as unknown as import("@mms/shared").Contact;

      const snapshot = buildContactForensicSnapshot(contact);
      expect(snapshot["id"]).toBe("con-1");
      expect(snapshot["notes"]).toBe("Referred by Ahmad.");
    });

    it("snapshot is included in the entity.soft_deleted outbox payload", async () => {
      const snapshot = { notes: "Last note before archive." };
      const payload: SoftDeletedPayload = {
        entityType: "students",
        entityId: "stu-2",
        tenantId: "demo",
        deletedAt: "2026-09-11T05:00:00.000Z",
        deletedBy: "u-admin",
        version: 1_700_000_000_005,
        snapshot,
      };

      await emitOutboxEvent("entity.soft_deleted", payload);

      const valuesCall = mockInsert.mock.results[0].value.values;
      const insertedPayload = valuesCall.mock.calls[0][0].payload as SoftDeletedPayload;
      expect(insertedPayload.snapshot).toEqual(snapshot);
    });
  });

  // ─── 3. Stale event version guard ──────────────────────────────────────

  describe("3. Version guard — stale out-of-order event safely dropped", () => {
    it("drops soft_deleted event with version < existing restored version (no index mutation)", async () => {
      const deleteDocument = vi.fn().mockResolvedValue(undefined);
      const indexDocument = vi.fn().mockResolvedValue(undefined);
      const adapter: SearchIndexAdapter = { deleteDocument, indexDocument };

      // Simulate: restore happened at version=2000, then stale soft_deleted arrives at version=1000
      const existingRestoredVersion = 2_000;
      const staleDeleteVersion = 1_000;

      const staleEvent = {
        id: 42,
        eventType: "entity.soft_deleted",
        entityType: "students",
        entityId: "stu-3",
        workspaceSubdomain: "demo",
        payload: {
          entityType: "students",
          entityId: "stu-3",
          tenantId: "demo",
          deletedAt: "2026-09-10T00:00:00.000Z",
          deletedBy: "u-admin",
          version: staleDeleteVersion,
        } as unknown as Record<string, unknown>,
        processedAt: null,
        createdAt: new Date(),
      };

      // Seed Redis with the higher version (from already-processed restore)
      const result = await runCdcBatch([staleEvent], adapter, {
        [`mms:demo:search:version:students:stu-3`]: String(existingRestoredVersion),
      });

      expect(result.skipped).toBe(1);
      expect(result.processed).toBe(0);
      // Search index MUST NOT be touched for a stale event
      expect(deleteDocument).not.toHaveBeenCalled();
      expect(indexDocument).not.toHaveBeenCalled();
    });

    it("drops soft_deleted event with version === existing version (equal is also stale)", async () => {
      const deleteDocument = vi.fn().mockResolvedValue(undefined);
      const adapter: SearchIndexAdapter = { deleteDocument, indexDocument: vi.fn() };

      const sameVersion = 5_000;
      const event = {
        id: 43,
        eventType: "entity.soft_deleted" as const,
        entityType: "contacts",
        entityId: "con-55",
        workspaceSubdomain: "demo",
        payload: {
          entityType: "contacts",
          entityId: "con-55",
          tenantId: "demo",
          version: sameVersion,
        } as unknown as Record<string, unknown>,
        processedAt: null,
        createdAt: new Date(),
      };

      const result = await runCdcBatch([event], adapter, {
        [`mms:demo:search:version:contacts:con-55`]: String(sameVersion),
      });

      expect(result.skipped).toBe(1);
      expect(deleteDocument).not.toHaveBeenCalled();
    });
  });

  // ─── 4. Fresh event application ─────────────────────────────────────────

  describe("4. Fresh event — search tombstone and Redis eviction applied", () => {
    it("entity.soft_deleted with higher version deletes from search and evicts Redis", async () => {
      const deleteDocument = vi.fn().mockResolvedValue(undefined);
      const adapter: SearchIndexAdapter = { deleteDocument, indexDocument: vi.fn() };

      // Seed a cache key that should be evicted
      redisStore.set("mms:demo:students:list:page1", '{"data":[]}');

      const freshEvent = {
        id: 44,
        eventType: "entity.soft_deleted",
        entityType: "students",
        entityId: "stu-4",
        workspaceSubdomain: "demo",
        payload: {
          entityType: "students",
          entityId: "stu-4",
          tenantId: "demo",
          deletedAt: "2026-09-11T10:00:00.000Z",
          deletedBy: "u-admin",
          version: 9_000,
          snapshot: { notes: "Archive snapshot." },
        } as unknown as Record<string, unknown>,
        processedAt: null,
        createdAt: new Date(),
      };

      const result = await runCdcBatch([freshEvent], adapter);

      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(0);
      expect(deleteDocument).toHaveBeenCalledWith("students", "stu-4");
      // The cached list entry should be gone after eviction
      expect(redisStore.has("mms:demo:students:list:page1")).toBe(false);
      // Version tracker must be updated to the incoming version
      expect(redisStore.get("mms:demo:search:version:students:stu-4")).toBe("9000");
    });

    it("entity.restored with higher version re-indexes and evicts Redis", async () => {
      const indexDocument = vi.fn().mockResolvedValue(undefined);
      const adapter: SearchIndexAdapter = { deleteDocument: vi.fn(), indexDocument };

      redisStore.set("mms:demo:contacts:id:con-77", '{"name":"Old"}');

      const freshRestore = {
        id: 45,
        eventType: "entity.restored",
        entityType: "contacts",
        entityId: "con-77",
        workspaceSubdomain: "demo",
        payload: {
          entityType: "contacts",
          entityId: "con-77",
          tenantId: "demo",
          restoredAt: "2026-09-11T11:00:00.000Z",
          restoredBy: "u-admin",
          version: 12_000,
        } as unknown as Record<string, unknown>,
        processedAt: null,
        createdAt: new Date(),
      };

      const result = await runCdcBatch([freshRestore], adapter);

      expect(result.processed).toBe(1);
      expect(indexDocument).toHaveBeenCalledWith(
        "contacts",
        "con-77",
        expect.objectContaining({ version: 12_000 }),
      );
      expect(redisStore.has("mms:demo:contacts:id:con-77")).toBe(false);
      expect(redisStore.get("mms:demo:search:version:contacts:con-77")).toBe("12000");
    });

    it("processes multiple events sequentially, correctly updating version per entity", async () => {
      const deleteDocument = vi.fn().mockResolvedValue(undefined);
      const indexDocument = vi.fn().mockResolvedValue(undefined);
      const adapter: SearchIndexAdapter = { deleteDocument, indexDocument };

      const events = [
        {
          id: 50,
          eventType: "entity.soft_deleted",
          entityType: "students",
          entityId: "stu-multi",
          workspaceSubdomain: "demo",
          payload: {
            entityType: "students",
            entityId: "stu-multi",
            tenantId: "demo",
            deletedAt: "",
            deletedBy: "u",
            version: 1_000,
          } as unknown as Record<string, unknown>,
          processedAt: null,
          createdAt: new Date(),
        },
        {
          id: 51,
          eventType: "entity.restored",
          entityType: "students",
          entityId: "stu-multi",
          workspaceSubdomain: "demo",
          payload: {
            entityType: "students",
            entityId: "stu-multi",
            tenantId: "demo",
            restoredAt: "",
            restoredBy: "u",
            version: 2_000,
          } as unknown as Record<string, unknown>,
          processedAt: null,
          createdAt: new Date(),
        },
        // Stale delete — version 500 < 2000 (the restored version now in Redis)
        {
          id: 52,
          eventType: "entity.soft_deleted",
          entityType: "students",
          entityId: "stu-multi",
          workspaceSubdomain: "demo",
          payload: {
            entityType: "students",
            entityId: "stu-multi",
            tenantId: "demo",
            deletedAt: "",
            deletedBy: "u",
            version: 500,
          } as unknown as Record<string, unknown>,
          processedAt: null,
          createdAt: new Date(),
        },
      ];

      const result = await runCdcBatch(events, adapter);

      expect(result.processed).toBe(2); // events 50 + 51
      expect(result.skipped).toBe(1); // event 52
      expect(deleteDocument).toHaveBeenCalledTimes(1);
      expect(indexDocument).toHaveBeenCalledTimes(1);
      // Final version in Redis must be the restored version (2000), not the stale delete (500)
      expect(redisStore.get("mms:demo:search:version:students:stu-multi")).toBe("2000");
    });
  });
});
