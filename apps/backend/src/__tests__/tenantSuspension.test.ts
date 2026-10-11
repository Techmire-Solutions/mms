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
import { adminToken } from "./helpers/tokens.js";
import { blockTenant, unblockTenant } from "../services/session.service.js";
import { clearInMemoryRedisFallback } from "../lib/redis.js";

describe("Immediate Tenant Suspension Hook", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    clearInMemoryRedisFallback();
    await app.close();
  });

  it("halts in-flight tenant requests immediately when tenant is blocked", async () => {
    const token = adminToken(app, { workspaceSubdomain: "demo" });

    // Initial check: active tenant succeeds
    const initialRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(initialRes.statusCode).toBe(200);

    // Block tenant in session / Redis
    await blockTenant("demo");

    // Subsequent check: immediately rejected with HTTP 403
    const blockedRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(blockedRes.statusCode).toBe(403);
    const body = blockedRes.json();
    expect(body.type).toBe("workspace_disabled");

    // Unblock tenant
    await unblockTenant("demo");

    // Restored check: succeeds again
    const restoredRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(restoredRes.statusCode).toBe(200);
  });
});
