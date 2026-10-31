import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAccountingRepo = vi.hoisted(() => ({
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

vi.mock("../db/repositories/accountingRepository.js", () => mockAccountingRepo);
vi.mock("../db/repositories/accountingLedgerOpsRepository.js", () => mockLedgerOpsRepo);
vi.mock("../db/repositories/accountingAccountsRepository.js", () => mockAccountsRepo);
vi.mock("../db/repositories/accountingFiscalYearsRepository.js", () => mockFiscalYearsRepo);
vi.mock("../db/repositories/obligationWakalaRepository.js", () => mockWakalaRepo);
vi.mock("../db/repositories/obligationDistributionsRepository.js", () => mockDistributionsRepo);
vi.mock("../lib/livePush.js", () => ({ broadcastTenantUpdate: vi.fn() }));

import {
  syncObligationJournal,
  tryPostObligationArchiveJournal,
  tryPostObligationJournal,
  tryPostObligationRestoreJournal,
} from "../accounting/ledgerPosting/obligationPostingService.js";
import { obligationEntrySourceId } from "../accounting/ledgerPosting/obligationPostingSources.js";
import type { ObligationCollection } from "@mms/shared";

const OPEN_YEAR = {
  id: "fy-1",
  label: "2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "active",
};

const FIRST_EPOCH_SUFFIX = obligationEntrySourceId("oc-101", 0).slice(-8);

describe("obligationPostingService", () => {
  const collection: ObligationCollection = {
    id: "oc-101",
    receipt_no: "REC-101",
    received_date: "2026-06-15",
    amount: 1000,
    currency_id: "usd",
    payment_mode: "Cash",
    obligation_type_id: "ot-khums",
    mujtahid_representative_id: "rep-1",
    sender_id: "cnt-1",
    received_by: "usr-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFiscalYearsRepo.listFiscalYearsByWorkspace.mockResolvedValue([OPEN_YEAR]);
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue(null);
    mockAccountingRepo.saveEntry.mockResolvedValue(undefined);
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      cashAccountId: "acc-cash",
      bankAccountId: "acc-bank",
      incomeAccountId: "acc-income",
    });
    mockAccountsRepo.listAccountsByWorkspace.mockResolvedValue([
      { id: "acc-cash", code: "10100", name: "Cash", type: "Asset", subtype: "Cash" },
      { id: "acc-bank", code: "10300", name: "Bank", type: "Asset", subtype: "Bank" },
      {
        id: "acc-income",
        code: "41000",
        name: "General Income",
        type: "Revenue",
        subtype: "Income",
      },
      {
        id: "acc-liab",
        code: "21000",
        name: "Wakala Payable",
        type: "Liability",
        subtype: "Payables",
      },
      {
        id: "acc-marja",
        code: "21200",
        name: "Marja Share Payable",
        type: "Liability",
        subtype: "Payables",
      },
    ]);
    mockWakalaRepo.listWakalaTypesByWorkspace.mockResolvedValue([
      { id: "wt-1", obligation_type_id: "ot-khums", mujtahid_representative_id: "rep-1" },
    ]);
    mockDistributionsRepo.listObligationDistributionsByWorkspace.mockResolvedValue([
      { id: "d1", name: "Madrassah Share", percentage: 50, type: "Income", wakala_type_id: "wt-1" },
      {
        id: "d2",
        name: "Marja Share",
        percentage: 50,
        type: "Liability",
        wakala_type_id: "wt-1",
        account_id: "acc-marja",
      },
    ]);
  });

  it("posts a balanced Dr Cash / Cr Distributions journal entry", async () => {
    await tryPostObligationJournal("tenant-1", collection);

    expect(mockAccountingRepo.saveEntry).toHaveBeenCalledTimes(1);
    const [, saved] = mockAccountingRepo.saveEntry.mock.calls[0];
    expect(saved.source_type).toBe("obligation");
    expect(saved.source_id).toBe(obligationEntrySourceId("oc-101", 0));
    expect(saved.ref).toBe("REC-101");
    expect(saved.lines).toHaveLength(3);

    // Dr Cash 1000
    expect(saved.lines[0].account_id).toBe("acc-cash");
    expect(saved.lines[0].debit).toBe(1000);
    expect(saved.lines[0].credit).toBe(0);

    // Cr Madrassah 500 (fell back to default income acc-income)
    expect(saved.lines[1].account_id).toBe("acc-income");
    expect(saved.lines[1].credit).toBe(500);

    // Cr Marja 500 (explicitly acc-marja)
    expect(saved.lines[2].account_id).toBe("acc-marja");
    expect(saved.lines[2].credit).toBe(500);
  });

  it("routes debit to Bank account when payment_mode is Bank or Online", async () => {
    const bankCollection = { ...collection, payment_mode: "Online" as const };
    await tryPostObligationJournal("tenant-1", bankCollection);

    expect(mockAccountingRepo.saveEntry).toHaveBeenCalledTimes(1);
    const [, saved] = mockAccountingRepo.saveEntry.mock.calls[0];
    expect(saved.lines[0].account_id).toBe("acc-bank");
    expect(saved.lines[0].debit).toBe(1000);
  });

  it("skips silently when workspace has no chart of accounts", async () => {
    mockAccountsRepo.listAccountsByWorkspace.mockResolvedValue([]);
    await tryPostObligationJournal("tenant-1", collection);
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("given a workspace with no configured cash account, should skip posting when creating", async () => {
    // Arrange
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({ incomeAccountId: "acc-income" });

    // Act
    await tryPostObligationJournal("tenant-1", collection);

    // Assert
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("given a distribution mapped to an account outside the chart, should skip posting", async () => {
    // Arrange
    mockDistributionsRepo.listObligationDistributionsByWorkspace.mockResolvedValue([
      {
        id: "d1",
        name: "Stale",
        percentage: 100,
        type: "Income",
        wakala_type_id: "wt-1",
        account_id: "acc-deleted",
      },
    ]);

    // Act
    await tryPostObligationJournal("tenant-1", collection);

    // Assert
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("given a collection that already posted, should not post again when created twice", async () => {
    // Arrange
    mockAccountingRepo.findEntryIdBySource.mockImplementation(
      async (_tenant: string, sourceType: string) =>
        sourceType === "obligation" ? "je-existing" : null,
    );

    // Act
    await tryPostObligationJournal("tenant-1", collection);

    // Assert
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("given an unchanged save, should leave the ledger alone when syncing", async () => {
    // Arrange
    const previous = { ...collection };

    // Act
    await syncObligationJournal("tenant-1", collection, previous);

    // Assert
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("given an edited amount, should reverse the stale entry and post the correction", async () => {
    // Arrange
    const postedSourceIds = new Set<string>();
    mockAccountingRepo.findEntryIdBySource.mockImplementation(
      async (_tenant: string, sourceType: string, sourceId: string) => {
        if (sourceType !== "obligation") return null;
        return postedSourceIds.has(sourceId) ? "je-existing" : null;
      },
    );
    await tryPostObligationJournal("tenant-1", collection);
    const originalSourceId = mockAccountingRepo.saveEntry.mock.calls[0][1].source_id as string;
    postedSourceIds.add(originalSourceId);
    mockAccountingRepo.findEntryById.mockResolvedValue({
      id: "je-existing",
      lines: [
        { id: "l1", account_id: "acc-cash", debit: 1000, credit: 0, description: "Dr" },
        { id: "l2", account_id: "acc-income", debit: 0, credit: 1000, description: "Cr" },
      ],
    });
    mockAccountingRepo.saveEntry.mockClear();

    // Act
    await syncObligationJournal("tenant-1", { ...collection, amount: 1200 }, collection);

    // Assert
    const saved = mockAccountingRepo.saveEntry.mock.calls.map((call) => call[1]);
    expect(saved).toHaveLength(2);
    expect(saved[0].source_type).toBe("reversal");
    expect(saved[0].lines[0].credit).toBe(1000);
    expect(saved[1].source_type).toBe("obligation");
    expect(saved[1].source_id).not.toBe(originalSourceId);
    expect(saved[1].lines[0].debit).toBe(1200);
  });

  it("given an archived collection, should reverse its posting when archiving", async () => {
    // Arrange
    mockAccountingRepo.findEntryIdBySource.mockImplementation(
      async (_tenant: string, sourceType: string, sourceId: string) =>
        sourceType === "obligation" && sourceId.endsWith(FIRST_EPOCH_SUFFIX) ? "je-existing" : null,
    );
    mockAccountingRepo.findEntryById.mockResolvedValue({
      id: "je-existing",
      lines: [
        { id: "l1", account_id: "acc-cash", debit: 1000, credit: 0, description: "Dr" },
        { id: "l2", account_id: "acc-income", debit: 0, credit: 1000, description: "Cr" },
      ],
    });

    // Act
    await tryPostObligationArchiveJournal("tenant-1", {
      ...collection,
      deletedAt: "2026-07-01T00:00:00.000Z",
    });

    // Assert
    expect(mockAccountingRepo.saveEntry).toHaveBeenCalledTimes(1);
    const [, saved] = mockAccountingRepo.saveEntry.mock.calls[0];
    expect(saved.source_type).toBe("reversal");
    expect(saved.lines[0].debit).toBe(0);
    expect(saved.lines[0].credit).toBe(1000);
  });

  it("given a collection that never posted, should not reverse anything when archiving", async () => {
    // Arrange
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue(null);

    // Act
    await tryPostObligationArchiveJournal("tenant-1", {
      ...collection,
      deletedAt: "2026-07-01T00:00:00.000Z",
    });

    // Assert
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("given an archived collection being restored, should re-apply its original posting", async () => {
    // Arrange
    const archivedAt = "2026-07-01T00:00:00.000Z";
    mockAccountingRepo.findEntryIdBySource.mockImplementation(
      async (_tenant: string, sourceType: string, sourceId: string) => {
        if (sourceType === "obligation" && sourceId.endsWith(FIRST_EPOCH_SUFFIX)) {
          return "je-existing";
        }
        return sourceType === "reversal" && sourceId.startsWith("archive-") ? "je-archive" : null;
      },
    );
    mockAccountingRepo.findEntryById.mockResolvedValue({
      id: "je-existing",
      lines: [
        { id: "l1", account_id: "acc-cash", debit: 1000, credit: 0, description: "Dr" },
        { id: "l2", account_id: "acc-income", debit: 0, credit: 1000, description: "Cr" },
      ],
    });

    // Act
    await tryPostObligationRestoreJournal("tenant-1", collection, archivedAt);

    // Assert
    expect(mockAccountingRepo.saveEntry).toHaveBeenCalledTimes(1);
    const [, saved] = mockAccountingRepo.saveEntry.mock.calls[0];
    expect(saved.lines[0].debit).toBe(1000);
    expect(saved.lines[1].credit).toBe(1000);
  });
});
