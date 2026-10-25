import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
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

vi.mock("../accounting/use-cases/hedgeUseCases.js", () => ({
  createHedgeRelationship: (...args: unknown[]) => mockCreate(...args),
  postHedgeValuation: vi.fn(),
  previewHedgeValuation: vi.fn(),
  reclassifyHedgeReserve: vi.fn(),
  settleHedge: (...args: unknown[]) => mockSettle(...args),
}));

type Role = "admin" | "accountant" | "auditor" | "guardian";

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
    mockCreate.mockReset().mockResolvedValue({ id: "hedge-1", valuations: [] });
    mockSettle.mockReset().mockResolvedValue({ id: "hedge-1", valuations: [] });
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
});
