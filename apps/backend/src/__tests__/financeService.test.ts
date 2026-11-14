import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice, Payment } from "@mms/shared";

const mockFindInvoiceById = vi.fn();
const mockFindPaymentById = vi.fn();
const mockSaveInvoice = vi.fn();
const mockSavePayment = vi.fn();
const mockRunInTransaction = vi.fn();
const mockRecordModernAuditEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mockRecordModernAuditEvent,
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (callback: () => Promise<unknown>) => mockRunInTransaction(callback),
  runInGlobalTransaction: (callback: () => Promise<unknown>) => mockRunInTransaction(callback),
}));

vi.mock("../db/repositories/financeRepository.js", () => ({
  listInvoicesByWorkspace: vi.fn().mockResolvedValue([]),
  findInvoiceById: (...args: unknown[]) => mockFindInvoiceById(...args),
  findInvoicesByIds: vi.fn().mockResolvedValue([]),
  saveInvoice: (...args: unknown[]) => mockSaveInvoice(...args),
  bulkSoftDeleteInvoices: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
  bulkRestoreInvoices: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
  listPaymentsByWorkspace: vi.fn().mockResolvedValue([]),
  findPaymentById: (...args: unknown[]) => mockFindPaymentById(...args),
  findPaymentsByIds: vi.fn().mockResolvedValue([]),
  savePayment: (...args: unknown[]) => mockSavePayment(...args),
  bulkSoftDeletePayments: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
  bulkRestorePayments: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: vi.fn(),
}));

vi.mock("../db/repositories/financeBillingRepository.js", () => ({
  allocateNextInvoiceNumber: vi.fn().mockResolvedValue("INV-2026-0001"),
  replacePaymentAllocations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../finance/use-cases/financeDocumentFx.js", () => ({
  resolveDocumentFx: vi.fn().mockResolvedValue({}),
  resolvePaymentFx: vi.fn().mockResolvedValue({}),
}));
vi.mock("../accounting/ledgerPosting/ledgerPostingService.js", () => ({
  tryPostInvoiceJournal: vi.fn().mockResolvedValue(undefined),
  tryPostPaymentJournal: vi.fn().mockResolvedValue(undefined),
}));

import { createPayment } from "../services/financeService.js";

const invoice: Invoice = {
  id: "inv-1",
  studentId: "student-1",
  studentName: "Student One",
  class: "Class A",
  session: "2026",
  baseFee: 100,
  discountType: null,
  discountValue: 0,
  discountAmt: 0,
  finalAmt: 100,
  status: "partial",
  dueDate: "2026-08-01",
  paidDate: null,
  method: null,
  paidAmt: 40,
};

const payment: Payment = {
  id: "pay-1",
  invoiceId: invoice.id,
  studentId: invoice.studentId,
  studentName: invoice.studentName,
  amount: 60,
  date: "2026-07-27",
  method: "Cash",
  note: "",
};

describe("financeService createPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunInTransaction.mockImplementation((callback: () => Promise<unknown>) => callback());
    mockFindPaymentById.mockResolvedValue(null);
    mockFindInvoiceById.mockResolvedValue(invoice);
    mockSaveInvoice.mockResolvedValue(undefined);
    mockSavePayment.mockResolvedValue(undefined);
  });

  it("updates the invoice and saves payment in one transaction", async () => {
    await expect(createPayment(payment)).resolves.toEqual(payment);
    expect(mockRunInTransaction).toHaveBeenCalledTimes(1);
    expect(mockSaveInvoice).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        paidAmt: 100,
        status: "paid",
      }),
    );
    expect(mockSavePayment).toHaveBeenCalledWith("demo", payment);
  });

  it("rejects overpayment without saving either record", async () => {
    // A plain Error used to surface as a 500 through every route.
    await expect(createPayment({ ...payment, amount: 61 })).rejects.toMatchObject({
      statusCode: 422,
      message: "Payment amount exceeds the remaining invoice balance",
    });
    expect(mockSaveInvoice).not.toHaveBeenCalled();
    expect(mockSavePayment).not.toHaveBeenCalled();
  });

  it("rolls the payment back when the ledger posting fails", async () => {
    const { tryPostPaymentJournal } =
      await import("../accounting/ledgerPosting/ledgerPostingService.js");
    vi.mocked(tryPostPaymentJournal).mockRejectedValueOnce(new Error("period is closed"));

    const events: string[] = [];
    mockRunInTransaction.mockImplementation(async (callback: () => Promise<unknown>) => {
      try {
        const result = await callback();
        events.push("commit");
        return result;
      } catch (error) {
        events.push("rollback");
        throw error;
      }
    });

    await expect(createPayment(payment)).rejects.toThrow("period is closed");

    // Both writes happened inside the transaction that rolled back, so neither
    // the reduced invoice balance nor the payment row survives.
    expect(mockSaveInvoice).toHaveBeenCalled();
    expect(mockSavePayment).toHaveBeenCalled();
    expect(events).toEqual(["rollback"]);
    expect(mockRecordModernAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects allocations that do not add up to the amount applied", async () => {
    // A 100.00 payment carrying a 500.00 allocation used to be stored without complaint, and
    // nothing in the product reads the allocation table to notice (audit S3).
    await expect(
      createPayment({
        ...payment,
        amount: 60,
        allocations: [{ id: "a1", invoiceId: invoice.id, amount: 500 }],
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining("must add up"),
    });
    expect(mockSaveInvoice).not.toHaveBeenCalled();
    expect(mockSavePayment).not.toHaveBeenCalled();
  });

  it("rejects an allocation that targets another invoice", async () => {
    // Only the payment's own invoice has its balance updated, so a second invoice's allocation
    // would be a phantom settlement.
    await expect(
      createPayment({
        ...payment,
        amount: 60,
        allocations: [{ id: "a1", invoiceId: "inv-other", amount: 60 }],
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining("one invoice"),
    });
    expect(mockSavePayment).not.toHaveBeenCalled();
  });

  it("accepts a split that matches the applied amount on the payment's invoice", async () => {
    await expect(
      createPayment({
        ...payment,
        amount: 60,
        allocations: [
          { id: "a1", invoiceId: invoice.id, amount: 35.5 },
          { id: "a2", invoiceId: invoice.id, amount: 24.5 },
        ],
      }),
    ).resolves.toBeDefined();
    expect(mockSaveInvoice).toHaveBeenCalled();
  });

  it("returns an existing payment without double-counting it", async () => {
    mockFindPaymentById.mockResolvedValue(payment);
    await expect(createPayment(payment)).resolves.toEqual(payment);
    expect(mockFindInvoiceById).not.toHaveBeenCalled();
    expect(mockSaveInvoice).not.toHaveBeenCalled();
    expect(mockSavePayment).not.toHaveBeenCalled();
  });
});
