import { describe, expect, it, vi, beforeEach } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";

const mockRepo = vi.hoisted(() => ({
  markOverdueInvoices: vi.fn(),
  listOpenInvoicesForCollect: vi.fn(),
  applyLateFeeAmounts: vi.fn(),
  listInvoicesByIds: vi.fn(),
  markInvoicesReminded: vi.fn(),
  saveCreditNote: vi.fn(),
  listCreditNotesForInvoice: vi.fn(),
}));

const mockLedgerPosting = vi.hoisted(() => ({
  tryPostCreditNoteJournal: vi.fn(),
  tryPostInvoiceReversalJournal: vi.fn(),
  tryPostLateFeeJournals: vi.fn(),
  tryPostLateFeeReversalJournal: vi.fn(),
}));

const mockPrefs = vi.hoisted(() => ({
  loadFinanceModulePreferences: vi.fn(),
}));

const mockContacts = vi.hoisted(() => ({
  loadContactsByIdsForTenant: vi.fn(),
}));

const mockFinanceUseCases = vi.hoisted(() => ({
  financeUseCases: {
    getInvoiceById: vi.fn(),
    getInvoiceByIdForUpdate: vi.fn(),
    updateInvoiceById: vi.fn(),
  },
}));

const mockWs = vi.hoisted(() => ({
  broadcastTenantUpdate: vi.fn(),
}));

const mockRecordModernAuditEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mockRecordModernAuditEvent,
}));

vi.mock("../db/repositories/financeCollectRepository.js", () => mockRepo);
vi.mock("../accounting/ledgerPosting/ledgerPostingService.js", () => mockLedgerPosting);
vi.mock("../services/financePreferencesService.js", () => mockPrefs);
vi.mock("../services/contactService.js", () => mockContacts);
vi.mock("../finance/use-cases/financeUseCases.js", () => mockFinanceUseCases);
vi.mock("../lib/livePush.js", () => mockWs);

import {
  collectOverdueInvoices,
  remindOpenInvoices,
  cancelInvoice,
  createCreditNote,
  loadCreditNotes,
} from "../finance/use-cases/financeCollectUseCases.js";

describe("financeCollectUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("collectOverdueInvoices", () => {
    it("throws without tenant", async () => {
      await expect(collectOverdueInvoices()).rejects.toThrow(/Tenant context required/);
    });

    it("marks overdue without late fee if not requested", async () => {
      mockRepo.markOverdueInvoices.mockResolvedValue(3);
      mockPrefs.loadFinanceModulePreferences.mockResolvedValue({ lateFeePercent: "5" });

      const result = await runWithTenant("tenant-1", () =>
        collectOverdueInvoices({ applyLateFee: false }),
      );

      expect(result).toEqual({ markedOverdue: 3, lateFeesApplied: 0 });
      expect(mockRepo.markOverdueInvoices).toHaveBeenCalledWith("tenant-1", expect.any(String));
      expect(mockRepo.applyLateFeeAmounts).not.toHaveBeenCalled();
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "tenant-1",
        "collection",
        "finance_invoices",
      );
    });

    it("applies late fee to eligible open invoices when requested", async () => {
      mockRepo.markOverdueInvoices.mockResolvedValue(1);
      mockPrefs.loadFinanceModulePreferences.mockResolvedValue({ lateFeePercent: "10" });
      mockRepo.listOpenInvoicesForCollect.mockResolvedValue([
        {
          id: "inv-1",
          status: "overdue",
          finalAmt: 100,
          paidAmt: 0,
          creditedAmt: 0,
          lateFeeAmt: 0,
          dueDate: "2026-01-01",
        },
      ]);
      mockRepo.applyLateFeeAmounts.mockResolvedValue(undefined);
      mockLedgerPosting.tryPostLateFeeJournals.mockResolvedValue(undefined);

      const result = await runWithTenant("tenant-1", () =>
        collectOverdueInvoices({ applyLateFee: true }),
      );

      expect(result.markedOverdue).toBe(1);
      expect(result.lateFeesApplied).toBe(1);
      expect(mockRepo.applyLateFeeAmounts).toHaveBeenCalledWith("tenant-1", [
        { invoiceId: "inv-1", amount: 10 },
      ]);
      expect(mockLedgerPosting.tryPostLateFeeJournals).toHaveBeenCalled();
    });
  });

  describe("remindOpenInvoices", () => {
    it("returns empty result if reminders are disabled in preferences", async () => {
      mockPrefs.loadFinanceModulePreferences.mockResolvedValue({
        overdueReminder: false,
        feeReminders: false,
      });

      const result = await runWithTenant("tenant-1", () => remindOpenInvoices());

      expect(result).toEqual({ reminded: 0, skipped: 0, recipients: [] });
    });

    it("identifies eligible invoices and notifies contacts", async () => {
      mockPrefs.loadFinanceModulePreferences.mockResolvedValue({
        overdueReminder: true,
        feeReminders: true,
        reminderDaysBefore: "7",
      });
      mockRepo.listOpenInvoicesForCollect.mockResolvedValue([
        {
          id: "inv-1",
          status: "unpaid",
          finalAmt: 200,
          paidAmt: 0,
          creditedAmt: 0,
          dueDate: "2026-09-08",
          familyContactId: "c-1",
        },
      ]);
      mockContacts.loadContactsByIdsForTenant.mockResolvedValue([
        { id: "c-1", name: "Parent One", phone: "+1234567890", email: "p@test.com" },
      ]);
      mockRepo.markInvoicesReminded.mockResolvedValue(undefined);

      const result = await runWithTenant("tenant-1", () => remindOpenInvoices());

      expect(result.reminded).toBe(1);
      expect(result.recipients).toHaveLength(1);
      expect(result.recipients[0]?.phone).toBe("+1234567890");
      expect(mockRepo.markInvoicesReminded).toHaveBeenCalledWith("tenant-1", ["inv-1"]);
    });
  });

  describe("cancelInvoice", () => {
    it("throws 404 when invoice not found", async () => {
      mockFinanceUseCases.financeUseCases.getInvoiceByIdForUpdate.mockResolvedValue(null);

      await expect(runWithTenant("tenant-1", () => cancelInvoice("inv-missing"))).rejects.toThrow(
        /Invoice not found/,
      );
    });

    it("throws 422 when invoice is already paid", async () => {
      mockFinanceUseCases.financeUseCases.getInvoiceByIdForUpdate.mockResolvedValue({
        id: "inv-paid",
        status: "paid",
        paidAmt: 100,
        finalAmt: 100,
      });

      await expect(runWithTenant("tenant-1", () => cancelInvoice("inv-paid"))).rejects.toThrow(
        /Only unpaid invoices can be cancelled/,
      );
    });

    it("cancels unpaid invoice, posts reversal journal, and broadcasts update", async () => {
      const invoice = { id: "inv-1", status: "unpaid", paidAmt: 0, finalAmt: 100 };
      const cancelled = { ...invoice, status: "cancelled" };
      mockFinanceUseCases.financeUseCases.getInvoiceByIdForUpdate.mockResolvedValue(invoice);
      mockFinanceUseCases.financeUseCases.updateInvoiceById.mockResolvedValue(cancelled);
      mockLedgerPosting.tryPostInvoiceReversalJournal.mockResolvedValue(undefined);
      mockLedgerPosting.tryPostLateFeeReversalJournal.mockResolvedValue(undefined);

      const result = await runWithTenant("tenant-1", () => cancelInvoice("inv-1"));

      expect(result.status).toBe("cancelled");
      expect(mockLedgerPosting.tryPostInvoiceReversalJournal).toHaveBeenCalledWith(
        "tenant-1",
        cancelled,
      );
      // Late fees post under their own source key, so reversing only the invoice
      // entry left the fee on the books.
      expect(mockLedgerPosting.tryPostLateFeeReversalJournal).toHaveBeenCalledWith(
        "tenant-1",
        cancelled,
      );
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "tenant-1",
        "collection",
        "finance_invoices",
      );
    });

    it("refuses to cancel a partially credited invoice and says what to do instead", async () => {
      // Cancelling reverses only the invoice entry, so the credit note's
      // Dr Income / Cr AR would survive and leave a credit AR balance.
      mockFinanceUseCases.financeUseCases.getInvoiceByIdForUpdate.mockResolvedValue({
        id: "inv-credited",
        status: "pending",
        paidAmt: 0,
        creditedAmt: 30,
        finalAmt: 100,
      });

      await expect(runWithTenant("tenant-1", () => cancelInvoice("inv-credited"))).rejects.toThrow(
        /Reverse the credit notes/,
      );
      expect(mockFinanceUseCases.financeUseCases.updateInvoiceById).not.toHaveBeenCalled();
    });
  });

  describe("createCreditNote", () => {
    it("rejects credit note exceeding open balance", async () => {
      mockFinanceUseCases.financeUseCases.getInvoiceByIdForUpdate.mockResolvedValue({
        id: "inv-1",
        status: "partial",
        finalAmt: 100,
        paidAmt: 80,
        creditedAmt: 0,
      });

      await expect(
        runWithTenant("tenant-1", () => createCreditNote({ invoiceId: "inv-1", amount: 50 })),
      ).rejects.toThrow(/Credit exceeds the open balance/);
    });

    it("creates credit note, updates invoice creditedAmt, and posts journal", async () => {
      const invoice = {
        id: "inv-1",
        status: "pending",
        finalAmt: 100,
        paidAmt: 0,
        creditedAmt: 0,
      };
      mockFinanceUseCases.financeUseCases.getInvoiceByIdForUpdate.mockResolvedValue(invoice);
      mockRepo.saveCreditNote.mockResolvedValue(undefined);
      mockFinanceUseCases.financeUseCases.updateInvoiceById.mockResolvedValue({
        ...invoice,
        creditedAmt: 100,
        status: "paid",
      });
      mockLedgerPosting.tryPostCreditNoteJournal.mockResolvedValue(undefined);

      const note = await runWithTenant("tenant-1", () =>
        createCreditNote({ invoiceId: "inv-1", amount: 100, reason: "Scholarship" }),
      );

      expect(note.amount).toBe(100);
      expect(note.reason).toBe("Scholarship");
      expect(mockRepo.saveCreditNote).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({ amount: 100 }),
      );
      expect(mockFinanceUseCases.financeUseCases.updateInvoiceById).toHaveBeenCalledWith(
        "inv-1",
        expect.objectContaining({ creditedAmt: 100, status: "paid" }),
      );
      expect(mockLedgerPosting.tryPostCreditNoteJournal).toHaveBeenCalled();
    });
  });

  describe("loadCreditNotes", () => {
    it("delegates to repository", async () => {
      mockRepo.listCreditNotesForInvoice.mockResolvedValue([{ id: "cn-1", amount: 50 }]);

      const result = await runWithTenant("tenant-1", () => loadCreditNotes("inv-1"));

      expect(result).toHaveLength(1);
      expect(mockRepo.listCreditNotesForInvoice).toHaveBeenCalledWith("tenant-1", "inv-1");
    });
  });
});
