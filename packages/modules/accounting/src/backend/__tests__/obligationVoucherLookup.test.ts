import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAccountingRepo = vi.hoisted(() => ({
  // The generated-posting path now runs the same postability guard as the manual
  // paths; these suites stub the lookup so they stay pure orchestration tests.
  lockPostableAccounts: vi.fn(async (_tenant: string, ids: string[]) =>
    ids.map((id) => ({ id, isActive: true, hasChildren: false })),
  ),
  bulkSaveEntries: vi.fn(),
  findEntryById: vi.fn(),
  findEntryIdBySource: vi.fn(),
  saveEntry: vi.fn(),
}));

const mockAccountsRepo = vi.hoisted(() => ({
  listAccountsByWorkspace: vi.fn(),
}));

const mockFiscalYearsRepo = vi.hoisted(() => ({
  listFiscalYearsByWorkspace: vi.fn(),
}));

const mockObligationsRepo = vi.hoisted(() => ({
  findObligationCollectionById: vi.fn(),
}));

vi.mock("../repository/accountingRepository.js", () => mockAccountingRepo);
vi.mock("../repository/accountingAccountsRepository.js", () => mockAccountsRepo);
vi.mock("../repository/accountingFiscalYearsRepository.js", () => mockFiscalYearsRepo);
vi.mock("@mms/be-core/audit", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@mms/be-core/realtime", () => ({ broadcastTenantUpdate: vi.fn() }));
vi.mock("../repository/workspaceDay.js", () => ({
  workspaceTodayIso: vi.fn().mockResolvedValue("2026-05-01"),
}));
vi.mock("../repository/accountingPostingPeriodsRepository.js", () => ({
  findClosedPostingPeriodForDate: vi.fn().mockResolvedValue(null),
}));

import { configureObligationVoucherPort } from "../ports/obligationVoucher.js";
import { findObligationJournalEntry } from "../ledgerPosting/obligationVoucherLookup.js";

// The obligation-collection read crosses into the obligations domain, so it is
// injected through the port rather than imported directly.
configureObligationVoucherPort({
  findObligationCollectionById: mockObligationsRepo.findObligationCollectionById,
  listWakalaTypesByWorkspace: vi.fn(),
  listObligationDistributionsByWorkspace: vi.fn(),
});

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
