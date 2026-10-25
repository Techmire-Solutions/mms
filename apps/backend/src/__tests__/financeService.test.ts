import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice, Payment } from "@mms/shared";

const mockFindInvoiceById = vi.fn();
const mockFindPaymentById = vi.fn();
const mockSaveInvoice = vi.fn();
const mockSavePayment = vi.fn();
const mockRunInTransaction = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (callback: () => Promise<unknown>) => mockRunInTransaction(callback),
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
    await expect(createPayment({ ...payment, amount: 61 })).rejects.toThrow(
      "Payment amount exceeds the remaining invoice balance",
    );
    expect(mockSaveInvoice).not.toHaveBeenCalled();
    expect(mockSavePayment).not.toHaveBeenCalled();
  });

  it("returns an existing payment without double-counting it", async () => {
    mockFindPaymentById.mockResolvedValue(payment);
    await expect(createPayment(payment)).resolves.toEqual(payment);
    expect(mockFindInvoiceById).not.toHaveBeenCalled();
    expect(mockSaveInvoice).not.toHaveBeenCalled();
    expect(mockSavePayment).not.toHaveBeenCalled();
  });
});
