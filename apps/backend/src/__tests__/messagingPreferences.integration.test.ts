import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { signTenantToken } from "./helpers/tokens.js";
import { DEFAULT_MESSAGING_PREFERENCES } from "@mms/shared";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
  findAuthArtifactByLookupKey: vi.fn(),
  tryClaimAuthArtifactByLookupKey: vi.fn(),
  updateAuthArtifactPayload: vi.fn(),
  deleteAuthArtifact: vi.fn(),
  authArtifactUserScopeKey: (userId: string) => `user:${userId}`,
  authArtifactWorkspaceScopeKey: (subdomain: string) => `ws:${subdomain}`,
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo"
          ? { id: "ws-demo", subdomain: "demo", madrasaName: "Demo Madrasa", enabled: true }
          : null,
      ),
  };
});

let storedPrefs: unknown = null;
vi.mock("../db/documentStoreObjects.js", () => ({
  getObject: vi.fn().mockImplementation(async () => storedPrefs),
  saveObject: vi.fn().mockImplementation(async (_key, data) => {
    storedPrefs = data;
  }),
}));

describe("Messaging Preferences Contract Routes", () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    storedPrefs = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/messaging/preferences requires authentication", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/preferences",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/messaging/preferences returns defaults for authorized user", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.preferences).toEqual(DEFAULT_MESSAGING_PREFERENCES);
  });

  it("PUT /api/messaging/preferences denies user without messaging.write permission", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/messaging/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "accountant", name: "accountant" })}`,
      },
      payload: {
        defaultChannel: "whatsapp",
        defaultSmsMode: "device",
        defaultDispatchSpeed: "safe",
        defaultCountryCode: "+44",
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("PUT /api/messaging/preferences saves and returns updated preferences for admin", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/messaging/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        defaultChannel: "whatsapp",
        defaultSmsMode: "device",
        defaultDispatchSpeed: "safe",
        defaultCountryCode: "+44",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.preferences).toEqual({
      defaultChannel: "whatsapp",
      defaultSmsMode: "device",
      defaultDispatchSpeed: "safe",
      defaultCountryCode: "+44",
    });
  });
});
