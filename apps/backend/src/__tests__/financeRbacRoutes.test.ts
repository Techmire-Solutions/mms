import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, accountantToken, guardianToken } from "./helpers/tokens.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
});

vi.mock("../db/tenant-context.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/tenant-context.js")>();
  return { ...actual, withTenant: (_tenant: string, work: () => unknown) => work() };
});

const mockCancel = vi.fn();
const mockCredit = vi.fn();
vi.mock("../finance/use-cases/financeCollectUseCases.js", () => ({
  cancelInvoice: (...args: unknown[]) => mockCancel(...args),
  createCreditNote: (...args: unknown[]) => mockCredit(...args),
  collectOverdueInvoices: vi.fn(),
  loadCreditNotes: vi.fn().mockResolvedValue([]),
  remindOpenInvoices: vi.fn(),
}));

const mockUpsertFee = vi.fn();
const mockRemoveFee = vi.fn();
vi.mock("../finance/use-cases/financeBillingUseCases.js", () => ({
  loadFeeStructures: vi.fn().mockResolvedValue([]),
  upsertFeeStructure: (...args: unknown[]) => mockUpsertFee(...args),
  removeFeeStructure: (...args: unknown[]) => mockRemoveFee(...args),
}));
vi.mock("../finance/use-cases/financeInvoiceGenerationUseCases.js", () => ({
  generateInvoices: vi.fn(),
}));

const mockCloseFiscalYear = vi.fn();
const mockClosePeriod = vi.fn();
const mockReopenPeriod = vi.fn();
vi.mock("../accounting/use-cases/accountingLedgerOpsUseCases.js", () => ({
  closeFiscalYear: (...args: unknown[]) => mockCloseFiscalYear(...args),
  closePostingPeriod: (...args: unknown[]) => mockClosePeriod(...args),
  reopenPostingPeriod: (...args: unknown[]) => mockReopenPeriod(...args),
  loadBankStatements: vi.fn().mockResolvedValue([]),
  loadOpeningBalances: vi.fn().mockResolvedValue([]),
  loadPostingPeriods: vi.fn().mockResolvedValue([]),
  loadPostingRules: vi.fn().mockResolvedValue(null),
  matchBankStatementLine: vi.fn(),
  postOpeningBalances: vi.fn(),
  upsertBankStatement: vi.fn(),
  upsertOpeningBalances: vi.fn(),
  upsertPostingRules: vi.fn(),
}));

const mockLoadNumbering = vi.fn();
const mockSaveNumbering = vi.fn();
vi.mock("../accounting/use-cases/accountingVoucherNumberingUseCases.js", () => ({
  loadVoucherNumbering: (...args: unknown[]) => mockLoadNumbering(...args),
  upsertVoucherNumbering: (...args: unknown[]) => mockSaveNumbering(...args),
}));

const NUMBERING = {
  autoGenerate: true,
  prefix: "JE",
  delimiter: "-",
  yearFormat: "NONE",
  sequenceDigits: 4,
  startingSequence: 1,
  rolloverPolicy: "never",
  currentSequence: 3,
  periodYear: 0,
  nextVoucherNumber: "JE-0004",
};

type Role = "admin" | "accountant" | "guardian";

async function send(
  role: Role,
  method: "POST" | "PUT" | "DELETE",
  url: string,
  payload: Record<string, unknown> = {},
) {
  const app = await buildApp();
  const tokens = { admin: adminToken, accountant: accountantToken, guardian: guardianToken };
  const res = await app.inject({
    method,
    url,
    headers: {
      host: "demo.localhost",
      authorization: `Bearer ${tokens[role](app)}`,
      "content-type": "application/json",
    },
    payload,
  });
  await app.close();
  return res;
}

const PERIOD = {
  id: "pp-1",
  fiscalYearId: "fy-1",
  label: "2026-01",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  status: "open",
};

describe("privileged finance/accounting routes require the manage capability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCancel.mockResolvedValue({ id: "inv-1", status: "cancelled" });
    mockCredit.mockResolvedValue({ id: "cn-1", invoiceId: "inv-1", amount: 10, reason: "waiver" });
    mockUpsertFee.mockResolvedValue({ id: "fs-1" });
    mockRemoveFee.mockResolvedValue(undefined);
    // The response is schema-validated now: a partial fiscal year would be a
    // `contract_violation` 500 instead of the close result.
    mockCloseFiscalYear.mockResolvedValue({
      id: "fy-1",
      label: "2025-2026",
      startDate: "2025-07-01",
      endDate: "2026-06-30",
      status: "closed",
    });
    mockClosePeriod.mockResolvedValue({ ...PERIOD, status: "closed" });
    mockReopenPeriod.mockResolvedValue(PERIOD);
    mockLoadNumbering.mockResolvedValue(NUMBERING);
    mockSaveNumbering.mockResolvedValue(NUMBERING);
  });

  it("refuses invoice cancellation to a write-only accountant", async () => {
    const refused = await send("accountant", "POST", "/api/finance/invoices/inv-1/cancel");
    const allowed = await send("admin", "POST", "/api/finance/invoices/inv-1/cancel");

    expect(refused.statusCode).toBe(403);
    expect(allowed.statusCode).toBe(200);
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("refuses credit notes (the fee-waiver path) to a write-only accountant", async () => {
    const body = { invoiceId: "inv-1", amount: 10, reason: "hardship waiver" };
    const refused = await send("accountant", "POST", "/api/finance/credit-notes", body);
    const allowed = await send("admin", "POST", "/api/finance/credit-notes", body);

    expect(refused.statusCode).toBe(403);
    expect(allowed.statusCode).toBe(200);
    expect(mockCredit).toHaveBeenCalledTimes(1);
  });

  it("refuses fee-schedule changes to a write-only accountant", async () => {
    const body = { name: "Monthly", items: [] };
    const putRefused = await send("accountant", "PUT", "/api/finance/fee-structures", body);
    const delRefused = await send("accountant", "DELETE", "/api/finance/fee-structures/fs-1");
    const putAllowed = await send("admin", "PUT", "/api/finance/fee-structures", body);
    const delAllowed = await send("admin", "DELETE", "/api/finance/fee-structures/fs-1");

    expect(putRefused.statusCode).toBe(403);
    expect(delRefused.statusCode).toBe(403);
    expect(putAllowed.statusCode).toBe(200);
    expect(delAllowed.statusCode).toBe(200);
    expect(mockUpsertFee).toHaveBeenCalledTimes(1);
    expect(mockRemoveFee).toHaveBeenCalledTimes(1);
  });

  it("refuses fiscal-year close to a write-only accountant", async () => {
    const refused = await send("accountant", "POST", "/api/accounting/fiscal-years/fy-1/close", {});
    const allowed = await send("admin", "POST", "/api/accounting/fiscal-years/fy-1/close", {});

    expect(refused.statusCode).toBe(403);
    expect(allowed.statusCode).toBe(200);
    expect(mockCloseFiscalYear).toHaveBeenCalledTimes(1);
  });

  it("refuses posting-period close and reopen to a write-only accountant", async () => {
    const closeRefused = await send(
      "accountant",
      "POST",
      "/api/accounting/posting-periods/pp-1/close",
      {
        reason: "month end",
      },
    );
    const reopenRefused = await send(
      "accountant",
      "POST",
      "/api/accounting/posting-periods/pp-1/reopen",
      { reason: "late invoice" },
    );
    const closeAllowed = await send("admin", "POST", "/api/accounting/posting-periods/pp-1/close", {
      reason: "month end",
    });
    const reopenAllowed = await send(
      "admin",
      "POST",
      "/api/accounting/posting-periods/pp-1/reopen",
      { reason: "late invoice" },
    );

    expect(closeRefused.statusCode).toBe(403);
    expect(reopenRefused.statusCode).toBe(403);
    expect(closeAllowed.statusCode).toBe(200);
    expect(reopenAllowed.statusCode).toBe(200);
    expect(mockClosePeriod).toHaveBeenCalledWith("pp-1", expect.any(String), "month end");
    expect(mockReopenPeriod).toHaveBeenCalledWith("pp-1", expect.any(String), "late invoice");
  });

  it("refuses voucher renumbering to a write-only accountant", async () => {
    const config = {
      autoGenerate: true,
      prefix: "JE",
      delimiter: "-",
      yearFormat: "NONE",
      sequenceDigits: 4,
      startingSequence: 1,
      rolloverPolicy: "never",
    };
    const refused = await send("accountant", "PUT", "/api/accounting/voucher-numbering", config);
    const allowed = await send("admin", "PUT", "/api/accounting/voucher-numbering", config);

    expect(refused.statusCode).toBe(403);
    expect(allowed.statusCode).toBe(200);
    expect(mockSaveNumbering).toHaveBeenCalledTimes(1);
  });

  it("keeps guardians out of every privileged finance route", async () => {
    const refused = await send("guardian", "POST", "/api/finance/invoices/inv-1/cancel");
    expect(refused.statusCode).toBe(403);
    expect(mockCancel).not.toHaveBeenCalled();
  });
});
