import { describe, expect, it, vi, beforeEach } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";

const mockRepo = vi.hoisted(() => ({
  getPostingRules: vi.fn(),
  savePostingRules: vi.fn(),
  listOpeningBalances: vi.fn(),
  replaceOpeningBalances: vi.fn(),
  listBankStatements: vi.fn(),
  saveBankStatement: vi.fn(),
  matchBankReconciliation: vi.fn(),
}));

const mockPeriodClose = vi.hoisted(() => ({
  closeFiscalYearForTenant: vi.fn(),
}));

const mockPosting = vi.hoisted(() => ({
  tryPostOpeningJournal: vi.fn(),
}));

const mockWs = vi.hoisted(() => ({
  broadcastTenantUpdate: vi.fn(),
}));

const mockAccountsRepo = vi.hoisted(() => ({
  findAccountsByIds: vi.fn(),
}));

vi.mock("../db/repositories/accountingLedgerOpsRepository.js", () => mockRepo);
vi.mock("../db/repositories/accountingAccountsRepository.js", () => mockAccountsRepo);
vi.mock("../accounting/use-cases/accountingPeriodClose.js", () => mockPeriodClose);
vi.mock("../accounting/ledgerPosting/ledgerPostingService.js", () => mockPosting);
vi.mock("../lib/livePush.js", () => mockWs);

import {
  loadPostingRules,
  upsertPostingRules,
  loadOpeningBalances,
  upsertOpeningBalances,
  postOpeningBalances,
  closeFiscalYear,
  loadBankStatements,
  upsertBankStatement,
  matchBankStatementLine,
} from "../accounting/use-cases/accountingLedgerOpsUseCases.js";

describe("accountingLedgerOpsUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when tenant is missing", async () => {
    await expect(loadPostingRules()).rejects.toThrow(/Tenant context required/);
  });

  describe("posting rules", () => {
    it("loadPostingRules delegates to repo", async () => {
      mockRepo.getPostingRules.mockResolvedValue({ arAccountId: "acc-1" });

      const res = await runWithTenant("t-1", () => loadPostingRules());
      expect(res).toEqual({ arAccountId: "acc-1" });
      expect(mockRepo.getPostingRules).toHaveBeenCalledWith("t-1");
    });

    it("upsertPostingRules validates and broadcasts update", async () => {
      mockRepo.savePostingRules.mockResolvedValue(undefined);
      mockAccountsRepo.findAccountsByIds.mockResolvedValue([
        { id: "acc-ar", type: "Asset", code: "1100", name: "Accounts Receivable" },
        { id: "acc-cash", type: "Asset", code: "1000", name: "Cash" },
      ]);

      const res = await runWithTenant("t-1", () =>
        upsertPostingRules({ arAccountId: "acc-ar", cashAccountId: "acc-cash" }),
      );

      expect(res).toEqual({ arAccountId: "acc-ar", cashAccountId: "acc-cash" });
      expect(mockRepo.savePostingRules).toHaveBeenCalledWith("t-1", res);
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "t-1",
        "collection",
        "accounting_posting_rules",
      );
    });

    it("rejects a posting rule pointing at the wrong account type", async () => {
      // An Expense account as the income account silently misclassified revenue
      // in the Trial Balance and Income Statement, with no error anywhere.
      mockAccountsRepo.findAccountsByIds.mockResolvedValue([
        { id: "acc-exp", type: "Expense", code: "5000", name: "Salaries" },
      ]);

      await expect(
        runWithTenant("t-1", () => upsertPostingRules({ incomeAccountId: "acc-exp" })),
      ).rejects.toThrow(/expected Revenue/);
      expect(mockRepo.savePostingRules).not.toHaveBeenCalled();
    });

    it("rejects a posting rule pointing at an unknown or archived account", async () => {
      mockAccountsRepo.findAccountsByIds.mockResolvedValue([]);

      await expect(
        runWithTenant("t-1", () => upsertPostingRules({ arAccountId: "acc-gone" })),
      ).rejects.toThrow(/unknown or archived account/);
      expect(mockRepo.savePostingRules).not.toHaveBeenCalled();
    });

    it("rejects a posting rule pointing at a deactivated account", async () => {
      mockAccountsRepo.findAccountsByIds.mockResolvedValue([
        { id: "acc-cash", type: "Asset", code: "1000", name: "Cash", isActive: false },
      ]);

      await expect(
        runWithTenant("t-1", () => upsertPostingRules({ cashAccountId: "acc-cash" })),
      ).rejects.toThrow(/is deactivated/);
      expect(mockRepo.savePostingRules).not.toHaveBeenCalled();
    });

    it("skips the account lookup when no accounts are configured", async () => {
      mockRepo.savePostingRules.mockResolvedValue(undefined);

      await runWithTenant("t-1", () => upsertPostingRules({}));

      expect(mockAccountsRepo.findAccountsByIds).not.toHaveBeenCalled();
      expect(mockRepo.savePostingRules).toHaveBeenCalled();
    });
  });

  describe("opening balances", () => {
    it("loadOpeningBalances delegates to repo", async () => {
      mockRepo.listOpeningBalances.mockResolvedValue([
        { id: "ob-1", accountId: "acc-1", debit: 100, credit: 0 },
      ]);

      const res = await runWithTenant("t-1", () => loadOpeningBalances("fy-1"));
      expect(res).toHaveLength(1);
      expect(mockRepo.listOpeningBalances).toHaveBeenCalledWith("t-1", "fy-1");
    });

    it("upsertOpeningBalances saves rows with generated ids and broadcasts", async () => {
      mockRepo.replaceOpeningBalances.mockResolvedValue(undefined);

      const res = await runWithTenant("t-1", () =>
        upsertOpeningBalances("fy-1", [
          { fiscalYearId: "fy-1", accountId: "acc-1", debit: 50, credit: 0 } as any,
        ]),
      );

      expect(res).toHaveLength(1);
      expect(res[0]?.id).toBe("ob-1");
      expect(mockRepo.replaceOpeningBalances).toHaveBeenCalledWith("t-1", "fy-1", res);
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "t-1",
        "collection",
        "accounting_opening_balances",
      );
    });

    it("postOpeningBalances triggers journal posting and broadcasts", async () => {
      mockRepo.listOpeningBalances.mockResolvedValue([
        { id: "ob-1", accountId: "acc-1", debit: 100, credit: 100 },
      ]);
      mockPosting.tryPostOpeningJournal.mockResolvedValue({ id: "je-opening" });

      const res = await runWithTenant("t-1", () => postOpeningBalances("fy-1"));

      expect(res).toEqual({ posted: true });
      expect(mockPosting.tryPostOpeningJournal).toHaveBeenCalledWith(
        "t-1",
        "fy-1",
        expect.any(Array),
      );
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "t-1",
        "collection",
        "accounting_entries",
      );
    });

    it("postOpeningBalances reports an unchanged replay as not posted", async () => {
      // Previously this always answered `{ success: true }`, so editing opening
      // balances after the first post looked like it had been applied while the
      // ledger kept the original figures.
      mockRepo.listOpeningBalances.mockResolvedValue([
        { id: "ob-1", accountId: "acc-1", debit: 100, credit: 100 },
      ]);
      mockPosting.tryPostOpeningJournal.mockResolvedValue(null);

      const res = await runWithTenant("t-1", () => postOpeningBalances("fy-1"));

      expect(res).toEqual({ posted: false });
    });
  });

  describe("closeFiscalYear", () => {
    it("calls closeFiscalYearForTenant and broadcasts updates", async () => {
      mockPeriodClose.closeFiscalYearForTenant.mockResolvedValue({ id: "fy-1", status: "closed" });

      const res = await runWithTenant("t-1", () =>
        closeFiscalYear("fy-1", "admin-user", "re-acc-1"),
      );

      expect(res.status).toBe("closed");
      expect(mockPeriodClose.closeFiscalYearForTenant).toHaveBeenCalledWith(
        "t-1",
        "fy-1",
        "admin-user",
        "re-acc-1",
      );
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "t-1",
        "collection",
        "accounting_fiscal_years",
      );
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "t-1",
        "collection",
        "accounting_entries",
      );
    });
  });

  describe("bank statements and reconciliation", () => {
    it("loadBankStatements delegates to repo", async () => {
      mockRepo.listBankStatements.mockResolvedValue([{ id: "bs-1" }]);

      const res = await runWithTenant("t-1", () => loadBankStatements());
      expect(res).toHaveLength(1);
      expect(mockRepo.listBankStatements).toHaveBeenCalledWith("t-1");
    });

    it("upsertBankStatement validates and saves record", async () => {
      mockRepo.saveBankStatement.mockResolvedValue(undefined);

      const statement = {
        accountId: "acc-bank",
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        openingBalance: 1000,
        closingBalance: 1500,
        lines: [{ date: "2026-08-15", description: "Deposit", amount: 500 }],
      };

      const res = await runWithTenant("t-1", () => upsertBankStatement(statement));

      expect(res.accountId).toBe("acc-bank");
      expect(res.lines).toHaveLength(1);
      expect(res.lines[0]?.id).toBe("bsl-1");
      expect(mockRepo.saveBankStatement).toHaveBeenCalledWith("t-1", expect.any(Object));
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "t-1",
        "collection",
        "accounting_bank_statements",
      );
    });

    it("matchBankStatementLine records match and broadcasts", async () => {
      mockRepo.matchBankReconciliation.mockResolvedValue(undefined);

      await runWithTenant("t-1", () =>
        matchBankStatementLine({
          statementLineId: "bsl-1",
          journalEntryId: "je-1",
          journalLineId: "jel-1",
        }),
      );

      expect(mockRepo.matchBankReconciliation).toHaveBeenCalledWith("t-1", {
        statementLineId: "bsl-1",
        journalEntryId: "je-1",
        journalLineId: "jel-1",
      });
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "t-1",
        "collection",
        "accounting_bank_reconciliations",
      );
    });
  });
});
