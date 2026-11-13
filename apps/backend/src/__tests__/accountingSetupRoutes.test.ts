import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, adminToken, guardianToken } from "./helpers/tokens.js";

/**
 * Inject coverage for the accounting Setup field-config and preferences endpoints.
 * They are registered through the shared setup-config helper with their own
 * schemas and permissions, so a permission regression or a dropped route would not
 * be caught by the generic contract-router test.
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

const mockGetFieldConfig = vi.hoisted(() => vi.fn());
const mockSaveFieldConfig = vi.hoisted(() => vi.fn());
const mockGetPreferences = vi.hoisted(() => vi.fn());
const mockSavePreferences = vi.hoisted(() => vi.fn());

vi.mock("../services/accountingConfigService.js", () => ({
  getAccountingFieldConfigService: mockGetFieldConfig,
  updateAccountingFieldConfigService: mockSaveFieldConfig,
}));
vi.mock("../services/accountingPreferencesService.js", () => ({
  getAccountingPreferencesService: mockGetPreferences,
  updateAccountingPreferencesService: mockSavePreferences,
}));

const fieldConfig = { referencePrefix: "ACC", codeLength: 4 };
const preferences = { currency: "PKR", decimalPlaces: 2 };

async function inject(
  method: "GET" | "PUT",
  url: string,
  token: (app: Awaited<ReturnType<typeof buildApp>>) => string,
  body?: Record<string, unknown>,
) {
  const app = await buildApp();
  const res = await app.inject({
    method,
    url,
    headers: { host: "demo.localhost", authorization: `Bearer ${token(app)}` },
    ...(body === undefined ? {} : { payload: body }),
  });
  await app.close();
  return res;
}

describe("accounting setup config routes", () => {
  beforeEach(() => {
    mockGetFieldConfig.mockReset().mockResolvedValue(fieldConfig);
    mockSaveFieldConfig.mockReset().mockResolvedValue(fieldConfig);
    mockGetPreferences.mockReset().mockResolvedValue(preferences);
    mockSavePreferences.mockReset().mockResolvedValue(preferences);
  });

  it("loads and saves the field config for a reader with setup rights", async () => {
    const read = await inject("GET", "/api/accounting/field-config", accountantToken);
    const written = await inject("PUT", "/api/accounting/field-config", adminToken, {
      version: 1,
      enabledTabs: ["setup"],
      fields: {},
    });

    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ config: fieldConfig });
    expect(written.statusCode).toBe(200);
    expect(written.json()).toMatchObject({ success: true, config: fieldConfig });
    expect(mockSaveFieldConfig).toHaveBeenCalledTimes(1);
  });

  it("loads and saves the preferences", async () => {
    const read = await inject("GET", "/api/accounting/preferences", accountantToken);
    const written = await inject("PUT", "/api/accounting/preferences", adminToken, {
      currency: "PKR",
      decimalPlaces: 2,
    });

    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ preferences });
    expect(written.statusCode).toBe(200);
    expect(mockSavePreferences).toHaveBeenCalledTimes(1);
  });

  it("denies a role without accounting access and never calls the service", async () => {
    const res = await inject("GET", "/api/accounting/field-config", guardianToken);

    expect(res.statusCode).toBe(403);
    expect(mockGetFieldConfig).not.toHaveBeenCalled();
  });

  it("rejects an invalid field-config body before the service runs", async () => {
    const res = await inject("PUT", "/api/accounting/field-config", adminToken, { nope: true });

    expect(res.statusCode).toBe(400);
    expect(mockSaveFieldConfig).not.toHaveBeenCalled();
  });
});
