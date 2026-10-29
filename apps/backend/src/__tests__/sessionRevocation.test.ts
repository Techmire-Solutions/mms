import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
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

import { buildApp } from "../app.js";
import { signTenantToken } from "./helpers/tokens.js";
import { revokeToken, revokeAllUserSessions } from "../services/authSessionService.js";
import { clearInMemoryRedisFallback } from "../lib/redis.js";

describe("Enterprise Session Lifecycle & Token Revocation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    clearInMemoryRedisFallback();
    await app.close();
  });

  it("allows access with active un-revoked token", async () => {
    const jti = "active-jti-token-1";
    const token = signTenantToken(app, {
      id: "u-admin",
      workspaceSubdomain: "demo",
      jti,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().isAuthenticated).toBe(true);
  });

  it("immediately rejects token after revocation (<= 100ms)", async () => {
    const jti = "revoked-jti-token-2";
    const token = signTenantToken(app, {
      id: "u-admin",
      workspaceSubdomain: "demo",
      jti,
    });

    const start = performance.now();
    await revokeToken(jti);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("rejects user session when entire user session is revoked", async () => {
    const userId = `u-revoked-${randomUUID()}`;
    const token = signTenantToken(app, {
      id: userId,
      workspaceSubdomain: "demo",
      jti: `jti-${randomUUID()}`,
    });

    // Revoke all sessions for this user with timestamp after token issue
    await revokeAllUserSessions(userId);

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("allows access with a new token issued after user session revocation", async () => {
    const userId = `u-reauth-${randomUUID()}`;
    await revokeAllUserSessions(userId);
    await new Promise((r) => setTimeout(r, 5));

    // Issue a brand-new token after revocation
    const token = signTenantToken(app, {
      id: userId,
      workspaceSubdomain: "demo",
      jti: `jti-${randomUUID()}`,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
  });
});
