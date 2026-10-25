import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { NotFoundError } from "../lib/httpErrors.js";
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

const mockUpsert = vi.fn();
const mockLookup = vi.fn();
const mockUpdateSettings = vi.fn();

vi.mock("../accounting/use-cases/exchangeRateUseCases.js", () => ({
  getCurrencySettings: vi.fn(),
  listExchangeRates: vi.fn().mockResolvedValue([]),
  lookupExchangeRate: (...args: unknown[]) => mockLookup(...args),
  updateCurrencySettings: (...args: unknown[]) => mockUpdateSettings(...args),
  upsertExchangeRates: (...args: unknown[]) => mockUpsert(...args),
}));

type Role = "admin" | "accountant" | "auditor" | "guardian";

async function call(
  role: Role,
  method: "GET" | "PUT",
  url: string,
  payload?: Record<string, unknown>,
) {
  const app = await buildApp();
  const token =
    role === "admin"
      ? adminToken(app)
      : role === "accountant"
        ? accountantToken(app)
        : role === "auditor"
          ? auditorToken(app)
          : guardianToken(app);
  const res = await app.inject({
    method,
    url,
    headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
    payload,
  });
  await app.close();
  return res;
}

const RATE = {
  fromCurrency: "USD",
  toCurrency: "PKR",
  rateDate: "2026-10-01",
  rateType: "SPOT",
  rate: "280.5",
};

describe("PUT /api/accounting/exchange-rates", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockUpsert
      .mockReset()
      .mockResolvedValue([{ id: "r1", ...RATE, source: "manual", overrideReason: "" }]);
  });

  it("given a role without accounting write permission, should return 403 without saving", async () => {
    // Arrange / Act
    const guardian = await call("guardian", "PUT", "/api/accounting/exchange-rates", {
      rates: [RATE],
    });
    const auditor = await call("auditor", "PUT", "/api/accounting/exchange-rates", {
      rates: [RATE],
    });

    // Assert
    expect(guardian.statusCode).toBe(403);
    expect(auditor.statusCode).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("given a zero rate, a float rate or the same currency twice, should reject without saving", async () => {
    // Arrange
    const bad = [
      { ...RATE, rate: "0" },
      { ...RATE, rate: 280.5 },
      { ...RATE, toCurrency: "USD" },
    ];

    // Act
    const responses = await Promise.all(
      bad.map((rate) =>
        call("accountant", "PUT", "/api/accounting/exchange-rates", { rates: [rate] }),
      ),
    );

    // Assert
    expect(responses.map((res) => res.statusCode)).toEqual([400, 400, 400]);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("given a valid rate, should save it as the session user", async () => {
    // Arrange / Act
    const res = await call("accountant", "PUT", "/api/accounting/exchange-rates", {
      rates: [RATE],
    });

    // Assert
    expect(res.statusCode).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      { tenant: "demo", userId: expect.any(String) },
      [RATE],
    );
    expect(res.json().rates[0]).toMatchObject({ id: "r1", rate: "280.5" });
  });
});

describe("GET /api/accounting/exchange-rates/lookup", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLookup.mockReset();
  });

  it("given no rate on or before the date, should return 404 instead of assuming 1", async () => {
    // Arrange
    mockLookup.mockRejectedValue(
      new NotFoundError("No SPOT rate for USD→PKR on or before 2026-10-01"),
    );

    // Act
    const res = await call(
      "auditor",
      "GET",
      "/api/accounting/exchange-rates/lookup?fromCurrency=USD&toCurrency=PKR&date=2026-10-01",
    );

    // Assert
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ type: "not_found" });
  });

  it("given a lowercase currency code, should reject the query", async () => {
    // Arrange / Act
    const res = await call(
      "auditor",
      "GET",
      "/api/accounting/exchange-rates/lookup?fromCurrency=usd&toCurrency=PKR&date=2026-10-01",
    );

    // Assert
    expect(res.statusCode).toBe(400);
    expect(mockLookup).not.toHaveBeenCalled();
  });
});

describe("PUT /api/accounting/currency-settings", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockUpdateSettings.mockReset().mockResolvedValue({
      functionalCurrency: "PKR",
      presentationCurrency: "PKR",
      locked: true,
      enabledCurrencies: ["USD"],
    });
  });

  it("given a three-decimal functional currency, should reject it while ledger amounts are numeric", async () => {
    // Arrange / Act
    const res = await call("admin", "PUT", "/api/accounting/currency-settings", {
      functionalCurrency: "KWD",
      presentationCurrency: "KWD",
      enabledCurrencies: [],
    });

    // Assert
    expect(res.statusCode).toBe(400);
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it("given an accountant without setup rights, should return 403", async () => {
    // Arrange / Act
    const res = await call("accountant", "PUT", "/api/accounting/currency-settings", {
      functionalCurrency: "PKR",
      presentationCurrency: "PKR",
      enabledCurrencies: [],
    });

    // Assert
    expect(res.statusCode).toBe(403);
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it("given valid settings from an admin, should save them", async () => {
    // Arrange / Act
    const res = await call("admin", "PUT", "/api/accounting/currency-settings", {
      functionalCurrency: "PKR",
      presentationCurrency: "PKR",
      enabledCurrencies: ["USD"],
    });

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.json().settings).toMatchObject({
      functionalCurrency: "PKR",
      enabledCurrencies: ["USD"],
    });
  });
});
