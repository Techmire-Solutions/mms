import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  getPoolMetrics: vi.fn().mockReturnValue({ totalCount: 5, idleCount: 4, waitingCount: 0 }),
}));

vi.mock("../services/workspaceService.js", () => ({
  getWorkspaceBySubdomain: vi.fn().mockImplementation(async (subdomain: string) => {
    if (subdomain === "demo" || subdomain === "other") {
      return { id: 1, subdomain, enabled: true, madrasaName: "Test Madrasa" };
    }
    return null;
  }),
}));

import { buildApp } from "../app.js";

describe("Multi-Tenant Isolation & Authentication Middleware", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
    process.env.MMS_APP_DOMAIN = "mms.local";
  });

  it("rejects requests missing tenant subdomain with 403 Forbidden", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({
      id: 1,
      email: "admin@demo.com",
      workspaceSubdomain: "demo",
      role: "admin",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/contacts",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "This endpoint requires a tenant subdomain",
    });
    await app.close();
  });

  it("rejects cross-tenant access when token workspace does not match request host subdomain", async () => {
    const app = await buildApp();
    // Token is issued for 'demo', but request host header targets 'other.mms.local'
    const token = app.jwt.sign({
      id: 1,
      email: "admin@demo.com",
      workspaceSubdomain: "demo",
      role: "admin",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/contacts",
      headers: {
        host: "other.mms.local",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Token is not valid for this workspace",
    });
    await app.close();
  });

  it("rejects platform_access token on tenant endpoint with 401 Unauthorized", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({
      id: 99,
      email: "platform@mms.local",
      workspaceSubdomain: "demo",
      tokenType: "platform_access",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/contacts",
      headers: {
        host: "demo.mms.local",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      type: "auth_required",
      message: "Platform session cannot access tenant resources",
    });
    await app.close();
  });

  it("rejects refresh token on tenant resource endpoint with 401 Unauthorized", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({
      id: 1,
      email: "admin@demo.com",
      workspaceSubdomain: "demo",
      tokenType: "refresh",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/contacts",
      headers: {
        host: "demo.mms.local",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      type: "auth_required",
      message: "Refresh token cannot access this resource",
    });
    await app.close();
  });
});
