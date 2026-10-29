import { describe, expect, it, vi, beforeEach } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import type { Invoice } from "@mms/shared";

const mockRepo = vi.hoisted(() => ({
  saveCreditNote: vi.fn().mockResolvedValue(undefined),
}));
const mockLedger = vi.hoisted(() => ({
  tryPostCreditNoteJournal: vi.fn().mockResolvedValue(undefined),
}));
const mockFinanceUseCases = vi.hoisted(() => ({
  financeUseCases: {
    getInvoiceById: vi.fn(),
    getInvoiceByIdForUpdate: vi.fn(),
    updateInvoiceById: vi.fn(),
  },
}));
const mockAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockLivePush = vi.hoisted(() => ({ broadcastTenantUpdate: vi.fn() }));

vi.mock("../db/repositories/financeCollectRepository.js", () => mockRepo);
vi.mock("../accounting/ledgerPosting/ledgerPostingService.js", () => mockLedger);
vi.mock("../finance/use-cases/financeUseCases.js", () => mockFinanceUseCases);
vi.mock("../services/auditTrailService.js", () => ({ recordModernAuditEvent: mockAudit }));
vi.mock("../lib/livePush.js", () => mockLivePush);

import { createCreditNote } from "../finance/use-cases/financeCollectUseCases.js";

function invoiceWith(creditedAmt: number): Invoice {
  return {
    id: "inv-1",
    studentId: "s-1",
    studentName: "",
    class: "",
    session: "",
    baseFee: 100,
    discountValue: 0,
    discountAmt: 0,
    finalAmt: 100,
    status: "pending",
    dueDate: "2026-09-01",
    paidAmt: 0,
    creditedAmt,
  } as Invoice;
}

describe("createCreditNote serialisation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the invoice with FOR UPDATE and lets only the first credit through", async () => {
    let stored = invoiceWith(0);
    const useCases = mockFinanceUseCases.financeUseCases;
    // Serialised locking read: the second call observes the first credit.
    useCases.getInvoiceByIdForUpdate.mockImplementation(async () => ({ ...stored }));
    useCases.updateInvoiceById.mockImplementation(async (_id: string, changes: Invoice) => {
      stored = { ...stored, ...changes };
      return stored;
    });

    const first = await runWithTenant("tenant-1", () =>
      createCreditNote({ invoiceId: "inv-1", amount: 60 }),
    );

    await expect(
      runWithTenant("tenant-1", () => createCreditNote({ invoiceId: "inv-1", amount: 60 })),
    ).rejects.toThrow("Credit exceeds the open balance");

    expect(first.amount).toBe(60);
    expect(useCases.getInvoiceByIdForUpdate).toHaveBeenCalledTimes(2);
    expect(useCases.getInvoiceById).not.toHaveBeenCalled();
    expect(mockRepo.saveCreditNote).toHaveBeenCalledTimes(1);
    expect(mockLedger.tryPostCreditNoteJournal).toHaveBeenCalledTimes(1);
    expect(stored.creditedAmt).toBe(60);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ tableName: "finance_credit_notes", actionType: "CREATE" }),
    );
  });
});
