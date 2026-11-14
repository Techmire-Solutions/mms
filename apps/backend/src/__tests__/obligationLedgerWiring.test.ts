import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPosting = vi.hoisted(() => ({
  syncObligationJournal: vi.fn().mockResolvedValue(undefined),
  tryPostObligationJournal: vi.fn().mockResolvedValue(undefined),
  tryPostObligationArchiveJournal: vi.fn().mockResolvedValue(undefined),
  tryPostObligationRestoreJournal: vi.fn().mockResolvedValue(undefined),
}));

const mockTenantContext = vi.hoisted(() => ({
  getRequestTenant: vi.fn(() => "demo"),
}));

vi.mock("../accounting/ledgerPosting/obligationPostingService.js", () => mockPosting);
vi.mock("../lib/tenantContext.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/tenantContext.js")>();
  return { ...actual, getRequestTenant: mockTenantContext.getRequestTenant };
});
vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: vi.fn(),
  broadcastCollection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({}),
}));
vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvents: vi.fn().mockResolvedValue(undefined),
}));

import { createObligationsUseCases } from "../obligations/use-cases/obligationsUseCases.js";
import type { ObligationsRepository } from "../obligations/repository/obligationsRepository.js";
import type { ObligationCollection } from "@mms/shared";
import { HttpDomainError } from "../lib/httpErrors.js";

const ARCHIVED_AT = "2026-07-01T00:00:00.000Z";

function collectionFixture(overrides: Partial<ObligationCollection> = {}): ObligationCollection {
  return {
    id: "oc-1",
    receipt_no: "REC-1",
    received_date: "2026-06-15",
    sender_id: "cnt-1",
    amount: 1000,
    currency_id: "pkr",
    payment_mode: "Cash",
    obligation_type_id: "ot-1",
    mujtahid_representative_id: "rep-1",
    received_by: "usr-1",
    ...overrides,
  };
}

function buildRepo(stored: ObligationCollection[]): ObligationsRepository {
  const byId = new Map(stored.map((record) => [record.id, record]));
  return {
    // The fake writes through, so reading "previous" after the save would
    // return the new row — the ordering bug these tests have to catch.
    bulkSaveObligationCollections: vi.fn(async (_tenant: string, list: ObligationCollection[]) => {
      for (const record of list) byId.set(record.id, record);
    }),
    findObligationCollectionsByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      ids.map((id) => byId.get(id)).filter((record): record is ObligationCollection => !!record),
    ),
    findObligationCollectionById: vi.fn(
      async (_tenant: string, id: string) => byId.get(id) ?? null,
    ),
    saveObligationCollection: vi.fn(async (_tenant: string, record: ObligationCollection) => {
      byId.set(record.id, record);
    }),
    bulkSoftDeleteObligationCollections: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    bulkRestoreObligationCollections: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    listObligationCollectionsByWorkspace: vi.fn().mockResolvedValue([]),
    // The receipt guard needs a wakala for the fixture's type/representative pair.
    listWakalaTypesByWorkspace: vi
      .fn()
      .mockResolvedValue([
        { id: "wt-1", mujtahid_representative_id: "rep-1", obligation_type_id: "ot-1" },
      ]),
    replaceObligationCollectionsForWorkspace: vi.fn().mockResolvedValue(undefined),
  } as unknown as ObligationsRepository;
}

describe("obligations use-cases ledger wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantContext.getRequestTenant.mockReturnValue("demo");
  });

  it("given an edited collection, should pass the pre-write record when bulk upserting", async () => {
    // Arrange
    const previous = collectionFixture();
    const edited = collectionFixture({ amount: 1500 });
    const useCases = createObligationsUseCases(buildRepo([previous]));

    // Act
    const saved = await useCases.upsertObligationCollections([edited]);

    // Assert
    expect(saved).toEqual([edited]);
    expect(mockPosting.syncObligationJournal).toHaveBeenCalledWith("demo", edited, previous);
  });

  it("given a bulk upsert, should return the saved rows so the API response stays populated", async () => {
    // Arrange
    const record = collectionFixture({ id: "oc-2", receipt_no: "REC-2" });
    const useCases = createObligationsUseCases(buildRepo([]));

    // Act
    const saved = await useCases.upsertObligationCollections([record]);

    // Assert
    expect(saved).toEqual([record]);
  });

  it("given an archived collection, should reverse its posting when deleting", async () => {
    // Arrange
    const archived = collectionFixture({ deletedAt: ARCHIVED_AT });
    const useCases = createObligationsUseCases(buildRepo([archived]));

    // Act
    const deleted = await useCases.deleteObligationCollectionById("oc-1", "usr-1");

    // Assert
    expect(deleted).toBe(true);
    expect(mockPosting.tryPostObligationArchiveJournal).toHaveBeenCalledWith("demo", archived);
  });

  it("given a restored collection, should re-apply its posting with the archive timestamp", async () => {
    // Arrange
    const archived = collectionFixture({ deletedAt: ARCHIVED_AT });
    const useCases = createObligationsUseCases(buildRepo([archived]));

    // Act
    const restored = await useCases.restoreObligationCollectionById("oc-1", "usr-1");

    // Assert
    expect(restored).toBe(true);
    expect(mockPosting.tryPostObligationRestoreJournal).toHaveBeenCalledWith(
      "demo",
      archived,
      ARCHIVED_AT,
    );
  });

  it("given an infrastructure posting failure, should still complete the save", async () => {
    // A ledger outage (no statusCode) must not block recording money that was received: the write
    // stands, and the audit row written alongside it makes the unposted gap attributable.
    mockPosting.syncObligationJournal.mockRejectedValueOnce(new Error("connection reset"));
    const record = collectionFixture({ amount: 2000 });
    const useCases = createObligationsUseCases(buildRepo([collectionFixture()]));

    // Act
    const saved = await useCases.upsertObligationCollections([record]);

    // Assert
    expect(saved).toEqual([record]);
  });

  it("given a policy posting rejection, should reject the save so the receipt rolls back", async () => {
    // Security audit A3: the ledger *refusing* an entry (closed fiscal year, archived account) used
    // to be swallowed, leaving an accepted amount that disagreed with the books and no audit entry.
    mockPosting.syncObligationJournal.mockRejectedValueOnce(
      new HttpDomainError(422, "validation_error", "Cannot write into a closed fiscal year"),
    );
    const record = collectionFixture({ amount: 2000 });
    const useCases = createObligationsUseCases(buildRepo([collectionFixture()]));

    await expect(useCases.upsertObligationCollections([record])).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it("given a posting failure on archive, should reject the delete so the archive rolls back", async () => {
    // Arrange — archive + reversal share one transaction now: a receipt must never leave every
    // active view while its journal entry stays on the books (audit F13).
    mockPosting.tryPostObligationArchiveJournal.mockRejectedValueOnce(new Error("period closed"));
    const archived = collectionFixture({ deletedAt: ARCHIVED_AT });
    const useCases = createObligationsUseCases(buildRepo([archived]));

    // Act + Assert
    await expect(useCases.deleteObligationCollectionById("oc-1", "usr-1")).rejects.toThrow(
      "period closed",
    );
  });

  it("given a posting failure on restore, should reject the restore so it rolls back", async () => {
    // Arrange
    mockPosting.tryPostObligationRestoreJournal.mockRejectedValueOnce(new Error("period closed"));
    const archived = collectionFixture({ deletedAt: ARCHIVED_AT });
    const useCases = createObligationsUseCases(buildRepo([archived]));

    // Act + Assert
    await expect(useCases.restoreObligationCollectionById("oc-1", "usr-1")).rejects.toThrow(
      "period closed",
    );
  });
});
