import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  saveCollection: vi.fn().mockResolvedValue(undefined),
  getCollection: vi.fn().mockResolvedValue([]),
  saveObject: vi.fn().mockResolvedValue(undefined),
  getObject: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/dbSyncService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/dbSyncService.js")>();
  return {
    ...actual,
    synchronizeData: vi.fn().mockResolvedValue(undefined),
    fetchBackupSnapshot: vi.fn().mockResolvedValue({
      collections: {
        users: [{ id: "u-admin", role: "admin", email: "admin@test.com" }],
        contacts: [{ id: "c-1" }],
        students: [{ id: "s-1" }],
        message_logs: [{ id: "m-1", channel: "sms", body: "hello" }],
        genders: [{ id: "male" }],
      },
      objects: {
        branding: { madrasaName: "Demo Madrasa" },
        global_settings: { language: "en" },
      },
    }),
  };
});

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

// /backup and /sync now stream via the long-lived transaction + streaming producer.
vi.mock("../db/dbConnection.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/dbConnection.js")>();
  return {
    ...actual,
    beginLongLivedTenantTransaction: vi.fn(),
    enterActiveTransaction: vi.fn(),
  };
});

vi.mock("../db/streamingSnapshotProducer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/streamingSnapshotProducer.js")>();
  return {
    ...actual,
    streamSyncSnapshot: vi.fn(),
    streamBackupSnapshot: vi.fn(),
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
import { canDownloadBulkSync } from "../services/rbacService.js";
import { adminToken, signTenantToken } from "./helpers/tokens.js";

describe("rbac bulk sync download", () => {
  it("allows admin only", () => {
    expect(
      canDownloadBulkSync({
        id: "1",
        email: "a@b.c",
        name: "A",
        role: "admin",
        workspaceSubdomain: "x",
      }),
    ).toBe(true);
    expect(
      canDownloadBulkSync({
        id: "1",
        email: "a@b.c",
        name: "A",
        role: "teacher",
        workspaceSubdomain: "x",
      }),
    ).toBe(false);
  });
});

describe("tenant JWT binding", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects db sync without auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/db/sync",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("rejects backup export without auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/db/backup",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("rejects backup export for non-admin", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, { role: "teacher", id: "u1" });
    const res = await app.inject({
      method: "GET",
      url: "/api/db/backup",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    await app.close();
  });

  it("allows admin backup download of the full tenant snapshot", async () => {
    const { beginLongLivedTenantTransaction } = await import("../db/dbConnection.js");
    const { streamBackupSnapshot } = await import("../db/streamingSnapshotProducer.js");
    vi.mocked(beginLongLivedTenantTransaction).mockResolvedValue({
      tx: {},
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(streamBackupSnapshot).mockImplementation(async function* () {
      yield JSON.stringify({
        collections: {
          users: [{ id: "u-admin", role: "admin", email: "admin@test.com" }],
          contacts: [{ id: "c-1" }],
          students: [{ id: "s-1" }],
          message_logs: [{ id: "m-1", channel: "sms", body: "hello" }],
          genders: [{ id: "male" }],
        },
        objects: {
          branding: { madrasaName: "Demo Madrasa" },
          global_settings: { language: "en" },
        },
      });
    });

    const app = await buildApp();
    const token = adminToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/db/backup",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      collections: Record<string, unknown[]>;
      objects: Record<string, unknown>;
    };
    expect(body.collections.users).toEqual([
      { id: "u-admin", role: "admin", email: "admin@test.com" },
    ]);
    expect(body.collections.students).toEqual([{ id: "s-1" }]);
    expect(body.collections.message_logs).toEqual([{ id: "m-1", channel: "sms", body: "hello" }]);
    expect(body.collections).not.toHaveProperty("messages_u:peer");
    expect(body.collections.genders).toEqual([{ id: "male" }]);
    expect(body.objects.branding).toEqual({ madrasaName: "Demo Madrasa" });
    expect(body.objects).not.toHaveProperty("platform_super_users");
    await app.close();
  });

  it("rejects backup password step-up without auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify-password",
      headers: { host: "demo.localhost" },
      payload: { password: "whatever" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ type: "auth_required" });
    await app.close();
  });

  it("rejects backup password step-up for another account", async () => {
    const app = await buildApp();
    const token = adminToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify-password",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
      payload: { password: "whatever", email: "someone.else@demo.local" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ type: "invalid_credentials" });
    await app.close();
  });

  it("rejects contacts write without auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/contacts",
      headers: { host: "demo.localhost" },
      payload: { firstName: "Test" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ type: "auth_required" });
    await app.close();
  });

  it("rejects AI configuration access without auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/models",
      headers: { host: "demo.localhost" },
      payload: { provider: "openai" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ type: "auth_required" });
    await app.close();
  });

  it("rejects email integration for non-admin", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, { role: "teacher", id: "u1" });
    const res = await app.inject({
      method: "GET",
      url: "/api/email/integration",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    await app.close();
  });

  it("rejects db reset for non-admin", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, { role: "teacher", id: "u1" });
    const res = await app.inject({
      method: "POST",
      url: "/api/db/reset",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    await app.close();
  });

  it("rejects collection read for roles without access", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, { role: "viewer", id: "u1" });
    const res = await app.inject({
      method: "GET",
      url: "/api/db/collections/backups",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    await app.close();
  });

  it("sets security headers and request id", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { host: "localhost" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    const csp = String(res.headers["content-security-policy"] ?? "");
    expect(csp).toContain("media-src 'self' data: blob:");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("manifest-src 'self'");
    // Per-request nonce replaces 'unsafe-inline' for inline scripts.
    const scriptSrc = csp.match(/script-src [^;]+/)?.[0] ?? "";
    expect(scriptSrc).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(typeof res.headers["x-request-id"]).toBe("string");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-zA-Z_-]+$/);
    await app.close();
  });

  it("stamps the CSP nonce onto inline scripts in HTML responses", async () => {
    const app = await buildApp();
    app.get("/html-test", async (_req, reply) => {
      reply.type("text/html");
      return "<html><head><script>window.__theme = 1;</script></head><body></body></html>";
    });
    const res = await app.inject({
      method: "GET",
      url: "/html-test",
      headers: { host: "localhost" },
    });
    expect(res.statusCode).toBe(200);
    const csp = String(res.headers["content-security-policy"] ?? "");
    const nonceMatch = csp.match(/script-src 'self' 'nonce-([A-Za-z0-9+/=]+)'/);
    expect(nonceMatch).not.toBeNull();
    const nonce = nonceMatch![1];
    expect(res.body).toContain(`<script nonce="${nonce}">`);
    await app.close();
  });

  it("returns stable not found shape", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/does-not-exist",
      headers: { host: "localhost" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ type: "not_found" });
    await app.close();
  });

  describe("tenant database isolation controls", () => {
    it("blocks reading workspaces collection", async () => {
      const app = await buildApp();
      const token = adminToken(app);
      const res = await app.inject({
        method: "GET",
        url: "/api/db/collections/workspaces",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${token}`,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ type: "forbidden" });
      await app.close();
    });

    it("blocks writing workspaces collection", async () => {
      const app = await buildApp();
      const token = adminToken(app);
      const res = await app.inject({
        method: "POST",
        url: "/api/db/collections/workspaces",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${token}`,
        },
        payload: { data: [] },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ type: "forbidden" });
      await app.close();
    });

    it("allows admin to save collection backups", async () => {
      const app = await buildApp();
      const token = adminToken(app);
      const res = await app.inject({
        method: "POST",
        url: "/api/db/collections/backups",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${token}`,
        },
        payload: [],
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ success: true });
      await app.close();
    });

    it("blocks reading platform_super_users object", async () => {
      const app = await buildApp();
      const token = adminToken(app);
      const res = await app.inject({
        method: "GET",
        url: "/api/db/objects/platform_super_users",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${token}`,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ type: "forbidden" });
      await app.close();
    });

    it("blocks writing platform_super_users object", async () => {
      const app = await buildApp();
      const token = adminToken(app);
      const res = await app.inject({
        method: "POST",
        url: "/api/db/objects/platform_super_users",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${token}`,
        },
        payload: {},
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ type: "forbidden" });
      await app.close();
    });

    it("blocks sync upload payload with workspaces or platform_super_users", async () => {
      const app = await buildApp();
      const token = adminToken(app);

      // Attempt workspaces collection upload
      const resCol = await app.inject({
        method: "POST",
        url: "/api/db/sync",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${token}`,
        },
        payload: {
          collections: { workspaces: [] },
        },
      });
      expect(resCol.statusCode).toBe(403);
      expect(resCol.json()).toMatchObject({ type: "forbidden" });

      // Attempt platform_super_users object upload
      const resObj = await app.inject({
        method: "POST",
        url: "/api/db/sync",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${token}`,
        },
        payload: {
          objects: { platform_super_users: {} },
        },
      });
      expect(resObj.statusCode).toBe(403);
      expect(resObj.json()).toMatchObject({ type: "forbidden" });

      await app.close();
    });

    it("strips unsupported legacy collections instead of rejecting the restore", async () => {
      const app = await buildApp();
      const token = adminToken(app);
      const { synchronizeData } = await import("../services/dbSyncService.js");
      const res = await app.inject({
        method: "POST",
        url: "/api/db/sync",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${token}`,
        },
        payload: {
          collections: {
            users: [{ id: "u-admin", role: "admin", email: "admin@demo.local" }],
            audit_log: [{ id: "a-1" }],
            hasanat_payouts: [{ id: "legacy-1" }],
            sessionTypes: [{ id: "regular", name: "Regular" }],
          },
          objects: {
            branding: { madrasaName: "Demo" },
          },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ success: true });
      expect(synchronizeData).toHaveBeenCalledWith(
        expect.objectContaining({
          collections: expect.objectContaining({
            users: [{ id: "u-admin", role: "admin", email: "admin@demo.local" }],
          }),
        }),
        expect.any(AbortSignal),
        true,
      );
      const synced = vi.mocked(synchronizeData).mock.calls.at(-1)?.[0] as {
        collections: Record<string, unknown[]>;
      };
      expect(synced.collections).not.toHaveProperty("audit_log");
      expect(synced.collections).not.toHaveProperty("hasanat_payouts");
      expect(synced.collections).not.toHaveProperty("teacherStatuses");
      expect(synced.collections).not.toHaveProperty("sessionTypes");
      await app.close();
    });

    it("allows admin sync of allowlisted collections and strips legacy messages_u / teacherStatuses / sessionTypes", async () => {
      const app = await buildApp();
      const token = adminToken(app);
      const { synchronizeData } = await import("../services/dbSyncService.js");
      const res = await app.inject({
        method: "POST",
        url: "/api/db/sync",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${token}`,
        },
        payload: {
          collections: {
            users: [{ id: "u-admin", role: "admin", email: "admin@demo.local" }],
            "messages_u:peer": [{ id: "m1", text: "hello" }],
            teacherStatuses: [{ id: "active", name: "Active" }],
            sessionTypes: [{ id: "regular", name: "Regular" }],
            currencies: [{ id: "pkr", code: "PKR" }],
          },
          objects: {
            branding: { madrasaName: "Demo" },
          },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ success: true });
      const synced = vi.mocked(synchronizeData).mock.calls.at(-1)?.[0] as {
        collections: Record<string, unknown[]>;
      };
      expect(synced.collections).toHaveProperty("currencies");
      expect(synced.collections).not.toHaveProperty("messages_u:peer");
      expect(synced.collections).not.toHaveProperty("teacherStatuses");
      expect(synced.collections).not.toHaveProperty("sessionTypes");
      await app.close();
    });
  });
});
