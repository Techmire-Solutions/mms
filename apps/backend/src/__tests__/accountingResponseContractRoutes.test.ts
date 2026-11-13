import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, adminToken } from "./helpers/tokens.js";

/**
 * Response contracts for the Accounting API families that used to `reply.send`
 * hand-built payloads without validating them: ledger ops, reports, FX
 * revaluation, specialized entries, chart seeding and the journal-entry delete.
 *
 * A drifted payload must answer `500 contract_violation` (a server bug), and a
 * GET/seed that takes no input must reject one instead of ignoring it.
 */

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
  return {
    ...actual,
    withTenant: (_tenant: string, work: () => unknown) => work(),
    withTenantRead: (_tenant: string, work: () => unknown) => work(),
  };
});

const mockLedgerOps = vi.hoisted(() => ({
  loadPostingRules: vi.fn(),
  upsertPostingRules: vi.fn(),
  closeFiscalYear: vi.fn(),
  loadPostingPeriods: vi.fn(),
  closePostingPeriod: vi.fn(),
  reopenPostingPeriod: vi.fn(),
  loadOpeningBalances: vi.fn(),
  upsertOpeningBalances: vi.fn(),
  postOpeningBalances: vi.fn(),
  loadBankStatements: vi.fn(),
  upsertBankStatement: vi.fn(),
  matchBankStatementLine: vi.fn(),
}));
vi.mock("../accounting/use-cases/accountingLedgerOpsUseCases.js", () => mockLedgerOps);

const mockReportEndpoints = vi.hoisted(() => ({
  loadAccountLedger: vi.fn(),
  loadReceivablesAging: vi.fn(),
}));
vi.mock("../accounting/use-cases/accountingReportEndpointsUseCases.js", () => mockReportEndpoints);

const mockAggregates = vi.hoisted(() => vi.fn());
const mockDeleteEntry = vi.hoisted(() => vi.fn());
const mockLoadEntry = vi.hoisted(() => vi.fn());
vi.mock("../accounting/use-cases/accountingUseCases.js", () => ({
  accountingUseCases: {
    loadAccountingReportAggregates: mockAggregates,
    deleteJournalEntryById: mockDeleteEntry,
    loadEntryById: mockLoadEntry,
  },
}));

const mockPreviewFx = vi.hoisted(() => vi.fn());
const mockPreviewIas29 = vi.hoisted(() => vi.fn());
vi.mock("../accounting/use-cases/ias29UseCases.js", () => ({
  previewIas29Restatement: mockPreviewIas29,
}));
const mockListFxRuns = vi.hoisted(() => vi.fn());
const mockBuildFxReport = vi.hoisted(() => vi.fn());
vi.mock("../accounting/use-cases/fxRevaluationDeps.js", () => ({
  fxRevaluationDeps: { listRuns: mockListFxRuns },
  fxReportDeps: {},
}));
vi.mock("../accounting/use-cases/fxRevaluationUseCases.js", () => ({
  previewFxRevaluation: mockPreviewFx,
  postFxRevaluation: vi.fn(),
}));
vi.mock("../accounting/use-cases/fxReportUseCases.js", () => ({
  buildFxReport: mockBuildFxReport,
}));

const mockSpecializedEntry = vi.hoisted(() => vi.fn());
vi.mock("../accounting/use-cases/processSpecializedEntryUseCase.js", () => ({
  processSpecializedEntryUseCase: mockSpecializedEntry,
}));

const mockSeedChart = vi.hoisted(() => vi.fn());
vi.mock("../accounting/use-cases/seedDefaultChartOfAccounts.js", () => ({
  seedDefaultChartOfAccountsUseCase: mockSeedChart,
}));

const ledgerPage = {
  account: { id: "cash", code: "1010", name: "Cash", type: "Asset", subtype: "" },
  openingBalance: 0,
  lines: [],
  totalDebit: 0,
  totalCredit: 0,
  closingBalance: 0,
  page: 1,
  limit: 100,
  total: 0,
  hasMore: false,
};

const agingReport = {
  asOf: "2026-06-30",
  rows: [],
  totals: {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90_plus: 0,
    total: 0,
    invoiceCount: 0,
  },
  totalStudents: 0,
  page: 1,
  limit: 100,
  hasMore: false,
};

const fxRun = {
  id: "fxr-1",
  revaluationDate: "2026-11-30",
  status: "posted" as const,
  functionalCurrency: "PKR",
  totalUnrealized: "3000.00",
  entryId: "je-1",
  reversalEntryId: "je-2",
  lines: [],
};

const fxReport = {
  from: "2026-11-01",
  asOf: "2026-11-30",
  functionalCurrency: "PKR",
  exposure: [],
  realized: [],
  totalRealized: "0.00",
  revaluations: [],
};

const ias29Run = {
  id: "ias29-1",
  restatementDate: "2026-11-30",
  status: "posted" as const,
  closingIndex: "150.00",
  netMonetaryResult: "200.00",
  entryId: "je-1",
  reversalEntryId: "je-2",
  lines: [],
};

const period = {
  id: "pp-1",
  fiscalYearId: "fy-1",
  label: "2026-01",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  status: "open" as const,
};

async function request(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: Record<string, unknown> | string,
) {
  const app = await buildApp();
  const token = method === "GET" ? accountantToken(app) : adminToken(app);
  const res = await app.inject({
    method,
    url,
    headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { payload: typeof body === "string" ? body : body }),
  });
  await app.close();
  return res;
}

describe("accounting response contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLedgerOps.loadPostingRules.mockResolvedValue({ arAccountId: "ar" });
    mockLedgerOps.upsertPostingRules.mockResolvedValue({ arAccountId: "ar" });
    mockLedgerOps.loadPostingPeriods.mockResolvedValue([period]);
    mockLedgerOps.closePostingPeriod.mockResolvedValue({ ...period, status: "closed" });
    mockLedgerOps.reopenPostingPeriod.mockResolvedValue(period);
    mockLedgerOps.loadOpeningBalances.mockResolvedValue([]);
    mockLedgerOps.upsertOpeningBalances.mockResolvedValue([]);
    mockLedgerOps.postOpeningBalances.mockResolvedValue({ posted: false });
    mockLedgerOps.loadBankStatements.mockResolvedValue([]);
    mockLedgerOps.matchBankStatementLine.mockResolvedValue(undefined);
    mockAggregates.mockResolvedValue({ revenue: 0, expenses: 0 });
    mockReportEndpoints.loadAccountLedger.mockResolvedValue(ledgerPage);
    mockReportEndpoints.loadReceivablesAging.mockResolvedValue(agingReport);
    mockListFxRuns.mockResolvedValue([fxRun]);
    mockPreviewFx.mockResolvedValue(fxRun);
    mockPreviewIas29.mockResolvedValue(ias29Run);
    mockBuildFxReport.mockResolvedValue(fxReport);
    mockSpecializedEntry.mockResolvedValue({ type: "salary", entryId: "je-1", ledgerPosted: true });
    mockSeedChart.mockResolvedValue({
      count: 42,
      defaultsApplied: { retainedEarnings: true, cashAccount: false },
    });
  });

  it("validates the ledger-ops payloads and rejects a drifted one", async () => {
    const rules = await request("GET", "/api/accounting/posting-rules");
    const periods = await request("GET", "/api/accounting/posting-periods");
    const posts = await request("POST", "/api/accounting/opening-balances/fy-1/post");

    expect([rules.statusCode, periods.statusCode, posts.statusCode]).toEqual([200, 200, 200]);
    expect(posts.json()).toEqual({ success: true, posted: false });

    mockLedgerOps.loadPostingPeriods.mockResolvedValue([{ id: "pp-1" }]);
    const drifted = await request("GET", "/api/accounting/posting-periods");
    expect(drifted.statusCode).toBe(500);
    expect(drifted.json().type).toBe("contract_violation");
  });

  it("routes the remaining ledger-op and preview endpoints through their handlers", async () => {
    const opening = await request("PUT", "/api/accounting/opening-balances", {
      fiscalYearId: "fy-1",
      balances: [],
    });
    const reconciliation = await request("POST", "/api/accounting/bank-reconciliations", {
      statementLineId: "stmt-1",
      journalEntryId: "je-1",
      journalLineId: "jl-1",
    });
    const fxPreview = await request("POST", "/api/accounting/fx-revaluations/preview", {
      revaluationDate: "2026-11-30",
    });
    const iasPreview = await request("POST", "/api/accounting/ias29-restatements/preview", {
      restatementDate: "2026-11-30",
    });

    expect([opening.statusCode, reconciliation.statusCode]).toEqual([200, 200]);
    expect([fxPreview.statusCode, iasPreview.statusCode]).toEqual([200, 200]);
    expect(mockLedgerOps.upsertOpeningBalances).toHaveBeenCalledWith("fy-1", []);
    expect(mockLedgerOps.matchBankStatementLine).toHaveBeenCalledWith(
      expect.objectContaining({ statementLineId: "stmt-1" }),
    );
    expect(mockPreviewFx).toHaveBeenCalledWith(expect.anything(), "demo", "2026-11-30");
    expect(mockPreviewIas29).toHaveBeenCalledWith(expect.anything(), "demo", "2026-11-30");
  });

  it("validates the report payloads", async () => {
    expect((await request("GET", "/api/accounting/ledger?accountId=cash")).statusCode).toBe(200);
    expect(
      (await request("GET", "/api/accounting/receivables-aging?asOf=2026-06-30")).statusCode,
    ).toBe(200);
    expect((await request("GET", "/api/accounting/report-aggregates")).statusCode).toBe(200);

    mockReportEndpoints.loadAccountLedger.mockResolvedValue({
      ...ledgerPage,
      lines: [{ id: "l1", debit: "not-money" }],
    });
    const drifted = await request("GET", "/api/accounting/ledger?accountId=cash");
    expect(drifted.statusCode).toBe(500);
    expect(drifted.json().type).toBe("contract_violation");
  });

  it("validates the FX revaluation and FX report payloads", async () => {
    expect((await request("GET", "/api/accounting/fx-revaluations")).statusCode).toBe(200);
    expect(
      (await request("GET", "/api/accounting/fx-report?from=2026-11-01&asOf=2026-11-30"))
        .statusCode,
    ).toBe(200);

    mockBuildFxReport.mockResolvedValue({ ...fxReport, totalRealized: 12 });
    const drifted = await request(
      "GET",
      "/api/accounting/fx-report?from=2026-11-01&asOf=2026-11-30",
    );
    expect(drifted.statusCode).toBe(500);
    expect(drifted.json().type).toBe("contract_violation");
  });

  it("validates the specialized-entry and seed payloads", async () => {
    const salary = {
      type: "salary",
      date: "2026-06-30",
      note: "June salary",
      staffId: "staff-1",
      payPeriod: "2026-06",
      amount: "1000.00",
      expenseAccountId: "sal-exp",
      paymentAccountId: "cash",
    };
    const specialized = await request("POST", "/api/accounting/specialized-entries", salary);
    const seeded = await request("POST", "/api/accounting/accounts/seed-default", "");

    expect([specialized.statusCode, seeded.statusCode]).toEqual([201, 201]);
    expect(seeded.json()).toMatchObject({ success: true, count: 42 });

    mockSpecializedEntry.mockResolvedValue({ type: "salary", entryId: "je-1" });
    const drifted = await request("POST", "/api/accounting/specialized-entries", salary);
    expect(drifted.statusCode).toBe(500);
    expect(drifted.json().type).toBe("contract_violation");
  });

  it("rejects a query string on the GETs that take no input", async () => {
    const currency = await request("GET", "/api/accounting/currency-settings?x=1");
    const exchangeability = await request("GET", "/api/accounting/currency-exchangeability?x=1");
    const rules = await request("GET", "/api/accounting/posting-rules?x=1");
    const statements = await request("GET", "/api/accounting/bank-statements?x=1");
    const fx = await request("GET", "/api/accounting/fx-revaluations?x=1");

    expect([
      currency.statusCode,
      exchangeability.statusCode,
      rules.statusCode,
      statements.statusCode,
      fx.statusCode,
    ]).toEqual([400, 400, 400, 400, 400]);
    expect(rules.json().type).toBe("validation_error");
    expect(rules.json().details.issues?.[0]?.path).toBeDefined();
  });

  it("rejects a body on the seed route instead of ignoring it", async () => {
    const res = await request("POST", "/api/accounting/accounts/seed-default", {
      force: true,
    });

    expect(res.statusCode).toBe(400);
    expect(mockSeedChart).not.toHaveBeenCalled();
  });

  it("returns the shared envelope (with a code) when a posted entry cannot be deleted", async () => {
    const { HttpDomainError } = await import("../lib/httpErrors.js");
    const { ACCOUNTING_ERROR_CODES } = await import("@mms/shared");
    mockDeleteEntry.mockRejectedValue(
      Object.assign(
        new HttpDomainError(422, "validation_error", "Posted journal entries cannot be deleted"),
        { code: ACCOUNTING_ERROR_CODES.voucherPosted },
      ),
    );

    const res = await request("DELETE", "/api/accounting/entries/je-1");

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      type: "validation_error",
      code: "accounting.voucher.posted",
    });
  });
});

describe("single-entry read (register drawer)", () => {
  const entry = {
    id: "je-1",
    date: "2026-06-01",
    ref: "JE-2026-001",
    description: "Tuition",
    status: "posted" as const,
    created_by: "u1",
    tags: [],
    attachments: [],
    fiscal_year: "",
    lines: [
      { id: "l1", account_id: "cash", debit: 100, credit: 0, description: "" },
      { id: "l2", account_id: "fees", debit: 0, credit: 100, description: "" },
    ],
  };

  it("returns the full entry with its lines", async () => {
    mockLoadEntry.mockResolvedValue(entry);

    const res = await request("GET", "/api/accounting/entries/je-1");

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: "je-1", ref: "JE-2026-001" });
    expect(res.json().lines).toHaveLength(2);
  });

  it("answers 404 for an unknown entry (and for another tenant's id)", async () => {
    mockLoadEntry.mockResolvedValue(null);

    const res = await request("GET", "/api/accounting/entries/missing");

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ type: "not_found" });
  });

  it("refuses the read without accounting read permission", async () => {
    const { buildApp } = await import("../app.js");
    const { guardianToken } = await import("./helpers/tokens.js");
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/accounting/entries/je-1",
      headers: { host: "demo.localhost", authorization: `Bearer ${guardianToken(app)}` },
    });
    await app.close();

    expect(res.statusCode).toBe(403);
    expect(mockLoadEntry).not.toHaveBeenCalled();
  });
});
