import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, guardianToken } from "./helpers/tokens.js";

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

const mockLoad = vi.fn();
const mockUpsert = vi.fn();

vi.mock("../accounting/use-cases/accountingVoucherNumberingUseCases.js", () => ({
  loadVoucherNumbering: (...args: unknown[]) => mockLoad(...args),
  upsertVoucherNumbering: (...args: unknown[]) => mockUpsert(...args),
}));

const format = {
  autoGenerate: true,
  prefix: "JV",
  delimiter: "-",
  yearFormat: "YYYY",
  sequenceDigits: 4,
  startingSequence: 1,
  rolloverPolicy: "annual_fiscal",
};
const numbering = {
  ...format,
  currentSequence: 6,
  periodYear: 2025,
  nextVoucherNumber: "JV-2025-0007",
};

async function send(
  method: "GET" | "PUT",
  url: string,
  token?: "accountant" | "guardian",
  payload?: Record<string, unknown>,
) {
  const app = await buildApp();
  const authorization =
    token === "accountant"
      ? accountantToken(app)
      : token === "guardian"
        ? guardianToken(app)
        : undefined;
  const res = await app.inject({
    method,
    url,
    headers: {
      host: "demo.localhost",
      ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
    },
    ...(payload === undefined ? {} : { payload }),
  });
  await app.close();
  return res;
}

describe("accounting voucher numbering routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoad.mockReset().mockResolvedValue(numbering);
    mockUpsert.mockReset().mockResolvedValue(numbering);
  });

  it("requires authentication", async () => {
    expect((await send("GET", "/api/accounting/voucher-numbering")).statusCode).toBe(401);
  });

  it("forbids roles without accounting access", async () => {
    expect((await send("GET", "/api/accounting/voucher-numbering", "guardian")).statusCode).toBe(
      403,
    );
    const put = await send("PUT", "/api/accounting/voucher-numbering", "guardian", format);
    expect(put.statusCode).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns the numbering and next-number preview for the requested date", async () => {
    const res = await send(
      "GET",
      "/api/accounting/voucher-numbering?date=2026-05-01",
      "accountant",
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ numbering });
    expect(mockLoad).toHaveBeenCalledWith("2026-05-01");
  });

  it("rejects a malformed date", async () => {
    expect(
      (await send("GET", "/api/accounting/voucher-numbering?date=May-1", "accountant")).statusCode,
    ).toBe(400);
  });

  it("saves a valid format", async () => {
    const res = await send("PUT", "/api/accounting/voucher-numbering", "accountant", format);
    expect(res.statusCode).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(format);
  });

  it("rejects a prefix that is not plain alphanumerics", async () => {
    const res = await send("PUT", "/api/accounting/voucher-numbering", "accountant", {
      ...format,
      prefix: "J.V",
    });
    expect(res.statusCode).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects yearly restarts that would print no year", async () => {
    const res = await send("PUT", "/api/accounting/voucher-numbering", "accountant", {
      ...format,
      yearFormat: "NONE",
    });
    expect(res.statusCode).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
