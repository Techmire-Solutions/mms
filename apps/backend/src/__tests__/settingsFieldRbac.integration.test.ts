import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_BRANDING_SETTINGS,
  type GlobalSettings,
  type BrandingSettings,
} from "@mms/shared";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  saveObject: vi.fn().mockResolvedValue(undefined),
  getObject: vi.fn().mockResolvedValue(null),
}));

vi.mock("../db/repositories/workspaceRepository.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/repositories/workspaceRepository.js")>();
  return {
    ...actual,
    getWorkspaceGlobalSettings: vi.fn(),
    getWorkspaceBranding: vi.fn(),
    upsertWorkspaceGlobalSettings: vi.fn().mockResolvedValue(undefined),
    upsertWorkspaceBranding: vi.fn().mockResolvedValue(undefined),
    updateWorkspaceBrandingRow: vi.fn().mockResolvedValue(undefined),
  };
});

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

import { buildApp } from "../app.js";
import { teacherToken, adminToken } from "./helpers/tokens.js";
import {
  getWorkspaceGlobalSettings,
  getWorkspaceBranding,
  upsertWorkspaceGlobalSettings,
  upsertWorkspaceBranding,
} from "../db/repositories/workspaceRepository.js";

const mockedGetGlobalSettings = vi.mocked(getWorkspaceGlobalSettings);
const mockedGetBranding = vi.mocked(getWorkspaceBranding);
const mockedUpsertGlobalSettings = vi.mocked(upsertWorkspaceGlobalSettings);
const mockedUpsertBranding = vi.mocked(upsertWorkspaceBranding);

const storedGlobalSettings: GlobalSettings = {
  ...DEFAULT_GLOBAL_SETTINGS,
  language: "ar",
  twoFactor: true,
  sessionTimeout: "30",
  passwordPolicy: "basic",
  llmProvider: "openai",
  llmApiKey: "real-secret-key",
};

const storedBranding: BrandingSettings = {
  ...DEFAULT_BRANDING_SETTINGS,
  madrasaName: "Real Madrasa",
  primaryColor: "#111111",
};

describe("settings field-level RBAC (global_settings / branding)", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockedGetGlobalSettings.mockResolvedValue(storedGlobalSettings);
    mockedGetBranding.mockResolvedValue(storedBranding);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("non-admin GET global_settings sees public fields but admin fields redacted to defaults", async () => {
    const app = await buildApp();
    const token = teacherToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/db/objects/global_settings",
      headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as GlobalSettings;
    expect(body.language).toBe("ar");
    expect(body.twoFactor).toBe(DEFAULT_GLOBAL_SETTINGS.twoFactor);
    expect(body.sessionTimeout).toBe(DEFAULT_GLOBAL_SETTINGS.sessionTimeout);
    expect(body.passwordPolicy).toBe(DEFAULT_GLOBAL_SETTINGS.passwordPolicy);
    expect(body.llmProvider).toBe(DEFAULT_GLOBAL_SETTINGS.llmProvider);
    await app.close();
  });

  it("admin GET global_settings sees the full object, unredacted", async () => {
    const app = await buildApp();
    const token = adminToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/db/objects/global_settings",
      headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as GlobalSettings;
    expect(body.twoFactor).toBe(true);
    expect(body.sessionTimeout).toBe("30");
    expect(body.passwordPolicy).toBe("basic");
    await app.close();
  });

  it("non-admin POST global_settings can change public fields but not admin-only fields", async () => {
    const app = await buildApp();
    const token = teacherToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/db/objects/global_settings",
      headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
      payload: {
        ...storedGlobalSettings,
        language: "en",
        twoFactor: false,
        llmApiKey: "stolen-key",
      },
    });
    expect(res.statusCode).toBe(200);
    const saved = mockedUpsertGlobalSettings.mock.calls[0][1] as GlobalSettings;
    expect(saved.language).toBe("en");
    // Admin-only fields stay pinned to the currently-stored values, not the request body.
    expect(saved.twoFactor).toBe(true);
    expect(saved.llmApiKey).toBe("real-secret-key");
    await app.close();
  });

  it("admin POST global_settings can change admin-only fields", async () => {
    const app = await buildApp();
    const token = adminToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/db/objects/global_settings",
      headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
      payload: { ...storedGlobalSettings, twoFactor: false },
    });
    expect(res.statusCode).toBe(200);
    const saved = mockedUpsertGlobalSettings.mock.calls[0][1] as GlobalSettings;
    expect(saved.twoFactor).toBe(false);
    await app.close();
  });

  it("non-admin GET branding returns the full object, unfiltered", async () => {
    const app = await buildApp();
    const token = teacherToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/db/objects/branding",
      headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as BrandingSettings;
    expect(body.madrasaName).toBe("Real Madrasa");
    await app.close();
  });

  it("non-admin POST branding can change theme fields but not identity fields", async () => {
    const app = await buildApp();
    const token = teacherToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/db/objects/branding",
      headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
      payload: { ...storedBranding, madrasaName: "Hijacked Name", primaryColor: "#00ff00" },
    });
    expect(res.statusCode).toBe(200);
    const saved = mockedUpsertBranding.mock.calls[0][1] as BrandingSettings;
    expect(saved.primaryColor).toBe("#00ff00");
    expect(saved.madrasaName).toBe("Real Madrasa");
    await app.close();
  });

  it("admin POST branding can change identity fields", async () => {
    const app = await buildApp();
    const token = adminToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/db/objects/branding",
      headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
      payload: { ...storedBranding, madrasaName: "Renamed Madrasa" },
    });
    expect(res.statusCode).toBe(200);
    const saved = mockedUpsertBranding.mock.calls[0][1] as BrandingSettings;
    expect(saved.madrasaName).toBe("Renamed Madrasa");
    await app.close();
  });
});
