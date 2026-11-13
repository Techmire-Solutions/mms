import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAccountingRepo = vi.hoisted(() => ({
  // The generated-posting path now runs the same postability guard as the manual
  // paths; these suites stub the lookup so they stay pure orchestration tests.
  lockPostableAccounts: vi.fn(async (_tenant: string, ids: string[]) =>
    ids.map((id) => ({ id, isActive: true, hasChildren: false })),
  ),
  findEntryById: vi.fn(),
  findEntryIdBySource: vi.fn(),
  saveEntry: vi.fn(),
}));

const mockLedgerOpsRepo = vi.hoisted(() => ({
  getPostingRules: vi.fn(),
}));

const mockAccountsRepo = vi.hoisted(() => ({
  listAccountsByWorkspace: vi.fn(),
}));

const mockFiscalYearsRepo = vi.hoisted(() => ({
  listFiscalYearsByWorkspace: vi.fn(),
}));

const mockWakalaRepo = vi.hoisted(() => ({
  listWakalaTypesByWorkspace: vi.fn(),
}));

const mockDistributionsRepo = vi.hoisted(() => ({
  listObligationDistributionsByWorkspace: vi.fn(),
}));

const mockObligationsRepo = vi.hoisted(() => ({
  findObligationCollectionById: vi.fn(),
}));

vi.mock("../db/repositories/accountingRepository.js", () => mockAccountingRepo);
vi.mock("../db/repositories/accountingLedgerOpsRepository.js", () => mockLedgerOpsRepo);
vi.mock("../db/repositories/accountingAccountsRepository.js", () => mockAccountsRepo);
vi.mock("../db/repositories/accountingFiscalYearsRepository.js", () => mockFiscalYearsRepo);
vi.mock("../db/repositories/obligationWakalaRepository.js", () => mockWakalaRepo);
vi.mock("../db/repositories/obligationDistributionsRepository.js", () => mockDistributionsRepo);
vi.mock("../obligations/repository/obligationsRepositoryAdapter.js", () => ({
  obligationsRepository: mockObligationsRepo,
}));
vi.mock("../lib/livePush.js", () => ({ broadcastTenantUpdate: vi.fn() }));

import { findObligationJournalEntry } from "../accounting/ledgerPosting/obligationVoucherLookup.js";

describe("obligationVoucherLookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when collection does not exist", async () => {
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue(null);
    mockObligationsRepo.findObligationCollectionById.mockResolvedValue(null);

    const result = await findObligationJournalEntry("tenant-1", "oc-nonexistent");
    expect(result).toBeNull();
  });

  it("returns entry and accounts when already posted", async () => {
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue("je-123");
    mockAccountingRepo.findEntryById.mockResolvedValue({
      id: "je-123",
      ref: "REC-001",
      lines: [],
    });
    mockAccountsRepo.listAccountsByWorkspace.mockResolvedValue([
      { id: "acc-1", code: "10100", name: "Cash" },
    ]);

    const result = await findObligationJournalEntry("tenant-1", "oc-101");
    expect(result).not.toBeNull();
    expect(result?.entry.id).toBe("je-123");
    expect(result?.accounts).toHaveLength(1);
  });
});
