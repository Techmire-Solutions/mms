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

const mockPost = vi.fn();
const mockSaveIndices = vi.fn();
const mockSaveSettings = vi.fn();

vi.mock("../accounting/use-cases/ias29UseCases.js", () => ({
  postIas29Restatement: (...args: unknown[]) => mockPost(...args),
  previewIas29Restatement: vi.fn(),
  savePriceIndices: (...args: unknown[]) => mockSaveIndices(...args),
  updateHyperinflationSettings: (...args: unknown[]) => mockSaveSettings(...args),
}));

type Role = "admin" | "accountant" | "auditor" | "guardian";

async function call(
  role: Role,
  method: "PUT" | "POST",
  url: string,
  payload: Record<string, unknown>,
) {
  const app = await buildApp();
  const tokens = {
    admin: adminToken,
    accountant: accountantToken,
    auditor: auditorToken,
    guardian: guardianToken,
  };
  const res = await app.inject({
    method,
    url,
    headers: { host: "demo.localhost", authorization: `Bearer ${tokens[role](app)}` },
    payload,
  });
  await app.close();
  return res;
}

describe("IAS 29 routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockPost.mockReset().mockResolvedValue({ id: "ias29-1", status: "posted", lines: [] });
    mockSaveIndices.mockReset().mockResolvedValue([]);
    mockSaveSettings.mockReset();
  });

  it("given a role without accounting write permission, should refuse to post a restatement", async () => {
    // Arrange / Act
    const guardian = await call("guardian", "POST", "/api/accounting/ias29-restatements", {
      restatementDate: "2026-12-31",
    });
    const auditor = await call("auditor", "POST", "/api/accounting/ias29-restatements", {
      restatementDate: "2026-12-31",
    });

    // Assert
    expect([guardian.statusCode, auditor.statusCode]).toEqual([403, 403]);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("given an accountant and a valid date, should post as the session user", async () => {
    // Arrange / Act
    const res = await call("accountant", "POST", "/api/accounting/ias29-restatements", {
      restatementDate: "2026-12-31",
    });

    // Assert
    expect(res.statusCode).toBe(201);
    expect(mockPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenant: "demo" }),
      "2026-12-31",
    );
  });

  it("given a zero or float index level, should reject without saving", async () => {
    // Arrange
    const bad = [
      { indexDate: "2026-12-31", value: "0" },
      { indexDate: "2026-12-31", value: 150 },
    ];

    // Act
    const responses = await Promise.all(
      bad.map((point) =>
        call("admin", "PUT", "/api/accounting/price-indices", { points: [point] }),
      ),
    );

    // Assert
    expect(responses.map((res) => res.statusCode)).toEqual([400, 400]);
    expect(mockSaveIndices).not.toHaveBeenCalled();
  });

  it("given IAS 29 switched on without a monetary gain/loss account, should reject the settings", async () => {
    // Arrange / Act
    const res = await call("admin", "PUT", "/api/accounting/hyperinflation-settings", {
      enabled: true,
      netMonetaryAccountId: null,
      appliesFrom: null,
      indexName: "",
    });

    // Assert
    expect(res.statusCode).toBe(400);
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it("given an accountant, should allow saving index points (200) but forbid hyperinflation settings (403)", async () => {
    // Arrange
    mockSaveIndices.mockResolvedValueOnce([
      { indexDate: "2026-12-31", value: "150", source: "CPI" },
    ]);

    // Act
    const putIndices = await call("accountant", "PUT", "/api/accounting/price-indices", {
      points: [{ indexDate: "2026-12-31", value: "150" }],
    });
    const putSettings = await call("accountant", "PUT", "/api/accounting/hyperinflation-settings", {
      enabled: true,
      netMonetaryAccountId: "nmp",
      appliesFrom: "2026-01-01",
      indexName: "CPI",
    });

    // Assert
    expect(putIndices.statusCode).toBe(200);
    expect(mockSaveIndices).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenant: "demo" }),
      [expect.objectContaining({ indexDate: "2026-12-31", value: "150" })],
    );
    expect(putSettings.statusCode).toBe(403);
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });
});
