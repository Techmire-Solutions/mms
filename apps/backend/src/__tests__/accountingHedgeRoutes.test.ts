import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { makeHedgeRelationship } from "./helpers/accountingRouteFixtures.js";
import { accountantToken, adminToken, auditorToken, guardianToken } from "./helpers/tokens.js";

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

const mockCreate = vi.fn();
const mockSettle = vi.fn();
const mockDiscontinue = vi.fn();
const mockListPage = vi.fn();
const mockPreview = vi.fn();
const mockValuation = vi.fn();
const mockReclassify = vi.fn();

vi.mock("../accounting/use-cases/hedgeDeps.js", () => ({
  hedgeDeps: {
    store: { listHedgeRelationshipsPage: (...args: unknown[]) => mockListPage(...args) },
  },
}));

vi.mock("../accounting/use-cases/hedgeUseCases.js", () => ({
  createHedgeRelationship: (...args: unknown[]) => mockCreate(...args),
  postHedgeValuation: (...args: unknown[]) => mockValuation(...args),
  previewHedgeValuation: (...args: unknown[]) => mockPreview(...args),
  reclassifyHedgeReserve: (...args: unknown[]) => mockReclassify(...args),
  discontinueHedge: (...args: unknown[]) => mockDiscontinue(...args),
  settleHedge: (...args: unknown[]) => mockSettle(...args),
}));

type Role = "admin" | "accountant" | "auditor" | "guardian";

async function get(role: Role, url: string) {
  const app = await buildApp();
  const tokens = {
    admin: adminToken,
    accountant: accountantToken,
    auditor: auditorToken,
    guardian: guardianToken,
  };
  const res = await app.inject({
    method: "GET",
    url,
    headers: { host: "demo.localhost", authorization: `Bearer ${tokens[role](app)}` },
  });
  await app.close();
  return res;
}

async function call(role: Role, url: string, payload: Record<string, unknown>) {
  const app = await buildApp();
  const tokens = {
    admin: adminToken,
    accountant: accountantToken,
    auditor: auditorToken,
    guardian: guardianToken,
  };
  const res = await app.inject({
    method: "POST",
    url,
    headers: { host: "demo.localhost", authorization: `Bearer ${tokens[role](app)}` },
    payload,
  });
  await app.close();
  return res;
}

const HEDGE = {
  name: "USD import hedge",
  hedgeType: "cash_flow",
  direction: "buy",
  currency: "USD",
  notional: "1000",
  contractRate: "283",
  designationRate: "285",
  designationDate: "2026-10-01",
  maturityDate: "2027-01-31",
  hedgedItem: "Forecast USD purchase",
  riskManagementObjective: "Fix the PKR cost of the import",
  instrumentAccountId: "deriv",
  reserveAccountId: "cfhr",
  pnlAccountId: "hpl",
};

describe("hedge routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockCreate.mockReset().mockResolvedValue(makeHedgeRelationship());
    mockSettle
      .mockReset()
      .mockResolvedValue(makeHedgeRelationship({ status: "settled", settledReserve: "7000" }));
    mockDiscontinue
      .mockReset()
      .mockResolvedValue(makeHedgeRelationship({ status: "discontinued", settledReserve: "7000" }));
    mockListPage
      .mockReset()
      .mockResolvedValue({ hedges: [makeHedgeRelationship()], truncated: false });
    mockValuation.mockReset().mockResolvedValue(
      makeHedgeRelationship({
        id: "h-1",
        status: "active",
        valuations: [
          {
            valuationDate: "2026-11-30",
            kind: "valuation",
            rate: "290",
            instrumentValue: "7000",
            hedgedChange: "5000",
            effective: "5000",
            ineffective: "2000",
            entryId: "je-1",
            reversalEntryId: "je-2",
          },
        ],
      }),
    );
    mockReclassify
      .mockReset()
      .mockResolvedValue(makeHedgeRelationship({ status: "discontinued", settledReserve: "0" }));
    mockPreview.mockReset().mockResolvedValue({
      valuationDate: "2026-11-30",
      kind: "valuation",
      rate: "290",
      instrumentValue: "7000",
      hedgedChange: "5000",
      effective: "5000",
      ineffective: "2000",
      entryId: null,
      reversalEntryId: null,
    });
  });

  it("given a role without accounting write permission, should refuse to designate a hedge", async () => {
    // Arrange / Act
    const guardian = await call("guardian", "/api/accounting/hedges", HEDGE);
    const auditor = await call("auditor", "/api/accounting/hedges", HEDGE);

    // Assert
    expect([guardian.statusCode, auditor.statusCode]).toEqual([403, 403]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("given a cash flow hedge without a reserve account, should reject it without saving", async () => {
    // Arrange / Act
    const res = await call("accountant", "/api/accounting/hedges", {
      ...HEDGE,
      reserveAccountId: null,
    });

    // Assert
    expect(res.statusCode).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("given an accountant, should designate as the session user and settle by path id", async () => {
    // Arrange / Act
    const created = await call("accountant", "/api/accounting/hedges", HEDGE);
    const settled = await call("accountant", "/api/accounting/hedges/hedge-1/settle", {
      settlementDate: "2027-01-31",
      settlementRate: "292",
      cashAccountId: "cash",
    });

    // Assert
    expect([created.statusCode, settled.statusCode]).toEqual([201, 201]);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenant: "demo" }),
      HEDGE,
    );
    expect(mockSettle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenant: "demo" }),
      "hedge-1",
      expect.objectContaining({ settlementRate: "292" }),
    );
  });

  it("lists a bounded page and reports truncation", async () => {
    mockListPage.mockResolvedValue({ hedges: [makeHedgeRelationship()], truncated: true });

    const res = await get("accountant", "/api/accounting/hedges?limit=5");

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      hedges: [expect.objectContaining({ id: "hedge-1" })],
      truncated: true,
    });
    expect(mockListPage).toHaveBeenCalledWith("demo", 5);
  });

  it("rejects a page size above the list cap instead of reading unbounded", async () => {
    const res = await get("accountant", "/api/accounting/hedges?limit=101");

    expect(res.statusCode).toBe(400);
    expect(mockListPage).not.toHaveBeenCalled();
  });

  it("rejects an oversized path id before the use case runs", async () => {
    // find-my-way caps a path param (414) and `resourceIdParamsSchema` caps a bound
    // id (400); either way the id never reaches the use case.
    const oversized = "x".repeat(129);
    const res = await call("accountant", `/api/accounting/hedges/${oversized}/settle`, {
      settlementDate: "2027-01-31",
      settlementRate: "292",
      cashAccountId: "cash",
    });

    expect([400, 414]).toContain(res.statusCode);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("answers 500 contract_violation when a use case drifts from the declared response", async () => {
    // A partial payload used to be sent as-is; now it fails the response schema.
    mockCreate.mockResolvedValue({ id: "hedge-1" });

    const res = await call("accountant", "/api/accounting/hedges", HEDGE);

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ type: "contract_violation" });
  });

  it("previews the valuation record under the declared response schema", async () => {
    const res = await call("accountant", "/api/accounting/hedges/hedge-1/valuations/preview", {
      valuationDate: "2026-11-30",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      valuation: expect.objectContaining({
        valuationDate: "2026-11-30",
        kind: "valuation",
        effective: "5000",
        entryId: null,
      }),
    });
    expect(mockPreview).toHaveBeenCalledWith(expect.anything(), "demo", "hedge-1", "2026-11-30");
  });
});

describe("hedge discontinuation (IFRS 9.6.5.6)", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("discontinues an active hedge for the session user", async () => {
    const res = await call("accountant", "/api/accounting/hedges/hedge-1/discontinue", {
      date: "2026-12-31",
      reason: "Forecast purchase cancelled",
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().hedge.status).toBe("discontinued");
    expect(mockDiscontinue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenant: "demo" }),
      "hedge-1",
      { date: "2026-12-31", reason: "Forecast purchase cancelled" },
    );
  });

  it("refuses the write for a role without accounting write permission", async () => {
    const res = await call("guardian", "/api/accounting/hedges/hedge-1/discontinue", {
      date: "2026-12-31",
      reason: "Forecast purchase cancelled",
    });

    expect(res.statusCode).toBe(403);
    expect(mockDiscontinue).not.toHaveBeenCalled();
  });

  it("rejects a missing reason before the use case runs", async () => {
    const res = await call("accountant", "/api/accounting/hedges/hedge-1/discontinue", {
      date: "2026-12-31",
    });

    expect(res.statusCode).toBe(400);
    expect(mockDiscontinue).not.toHaveBeenCalled();
  });

  it("posts a valuation through the guarded write route and hides it from read-only roles", async () => {
    const denied = await call("auditor", "/api/accounting/hedges/h-1/valuations", {
      valuationDate: "2026-11-30",
    });
    const posted = await call("accountant", "/api/accounting/hedges/h-1/valuations", {
      valuationDate: "2026-11-30",
    });

    expect(denied.statusCode).toBe(403);
    expect(mockValuation).toHaveBeenCalledTimes(1);
    expect(mockValuation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenant: "demo" }),
      "h-1",
      "2026-11-30",
    );
    expect(posted.statusCode).toBe(201);
    expect(posted.json()).toMatchObject({ hedge: { id: "h-1" } });
  });

  it("reclassifies a hedge reserve through the guarded write route", async () => {
    const denied = await call("guardian", "/api/accounting/hedges/h-1/reclassify", {
      date: "2026-12-01",
      targetAccountId: "hpl",
    });
    const posted = await call("accountant", "/api/accounting/hedges/h-1/reclassify", {
      date: "2026-12-01",
      targetAccountId: "hpl",
    });

    expect(denied.statusCode).toBe(403);
    expect(mockReclassify).toHaveBeenCalledTimes(1);
    expect(posted.statusCode).toBe(201);
  });
});
