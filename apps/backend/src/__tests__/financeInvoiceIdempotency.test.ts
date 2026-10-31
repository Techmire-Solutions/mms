import { describe, expect, it, vi } from "vitest";
import type { Invoice, InvoiceCreateInput } from "@mms/shared";
import { createFinanceUseCases } from "../finance/use-cases/financeUseCases.js";
import type { FinanceRepository } from "../finance/repository/financeRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

const mockLedger = vi.hoisted(() => ({
  tryPostInvoiceJournal: vi.fn().mockResolvedValue(undefined),
}));
const mockBilling = vi.hoisted(() => ({
  allocateNextInvoiceNumber: vi.fn().mockResolvedValue("INV-2026-0001"),
  replacePaymentAllocations: vi.fn().mockResolvedValue(undefined),
}));
const mockStudents = vi.hoisted(() => ({
  findStudentsByIds: vi.fn().mockResolvedValue([{ id: "s-1", contactId: "c-1" }]),
}));
const mockDocumentFx = vi.hoisted(() => ({
  resolveDocumentFx: vi.fn().mockResolvedValue({ currency: "PKR", exchangeRate: "1" }),
  resolvePaymentFx: vi.fn().mockResolvedValue({}),
}));
const mockPrefs = vi.hoisted(() => ({
  loadFinanceModulePreferences: vi.fn().mockResolvedValue(null),
}));
const mockAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockLivePush = vi.hoisted(() => ({ broadcastTenantUpdate: vi.fn() }));

vi.mock("../accounting/ledgerPosting/ledgerPostingService.js", () => mockLedger);
vi.mock("../db/repositories/financeBillingRepository.js", () => mockBilling);
vi.mock("../db/repositories/studentRepository.js", () => mockStudents);
vi.mock("../finance/use-cases/financeDocumentFx.js", () => mockDocumentFx);
vi.mock("../services/financePreferencesService.js", () => mockPrefs);
vi.mock("../services/auditTrailService.js", () => ({ recordModernAuditEvent: mockAudit }));
vi.mock("../lib/livePush.js", () => mockLivePush);
vi.mock("../db/repositories/accountingRepository.js", () => ({
  findEntryIdBySource: vi.fn().mockResolvedValue(null),
}));

function fakeRepo(existing: Invoice | null): FinanceRepository {
  return {
    findInvoiceById: vi.fn().mockResolvedValue(existing),
    saveInvoice: vi.fn().mockResolvedValue(undefined),
  } as unknown as FinanceRepository;
}

const input: InvoiceCreateInput = {
  id: "inv-1",
  studentId: "s-1",
  studentName: "",
  class: "",
  session: "",
  dueDate: "2026-09-01",
  baseFee: 100,
  discountValue: 0,
  discountAmt: 0,
  finalAmt: 100,
  status: "pending",
};

function existingInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    studentId: "s-1",
    studentName: "",
    class: "",
    session: "",
    dueDate: "2026-09-01",
    baseFee: 100,
    discountValue: 0,
    discountAmt: 0,
    finalAmt: 100,
    status: "pending",
    ...overrides,
  } as Invoice;
}

describe("createInvoice idempotency", () => {
  it("returns the stored invoice for an exact replay without writing again", async () => {
    const repo = fakeRepo(existingInvoice());
    const useCases = createFinanceUseCases(repo);

    const result = await runWithTenant("tenant-1", () => useCases.createInvoice(input));

    expect(result).toEqual(existingInvoice());
    expect(repo.saveInvoice).not.toHaveBeenCalled();
    expect(mockLedger.tryPostInvoiceJournal).not.toHaveBeenCalled();
  });

  it("rejects a different payload on an existing id with a 409", async () => {
    const repo = fakeRepo(existingInvoice({ finalAmt: 250 }));
    const useCases = createFinanceUseCases(repo);

    await expect(
      runWithTenant("tenant-1", () => useCases.createInvoice(input)),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "invoice id already exists",
    });
    expect(repo.saveInvoice).not.toHaveBeenCalled();
  });

  it("does not treat a cancelled invoice as an idempotent replay", async () => {
    const repo = fakeRepo(existingInvoice({ status: "cancelled" }));
    const useCases = createFinanceUseCases(repo);

    await expect(
      runWithTenant("tenant-1", () => useCases.createInvoice(input)),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.saveInvoice).not.toHaveBeenCalled();
  });

  it("creates a new invoice and audits it when the id is unused", async () => {
    const repo = fakeRepo(null);
    const useCases = createFinanceUseCases(repo);

    await runWithTenant("tenant-1", () => useCases.createInvoice(input));

    expect(repo.saveInvoice).toHaveBeenCalledTimes(1);
    expect(mockLedger.tryPostInvoiceJournal).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "finance_invoices",
        recordId: "inv-1",
        actionType: "CREATE",
      }),
    );
  });
});
