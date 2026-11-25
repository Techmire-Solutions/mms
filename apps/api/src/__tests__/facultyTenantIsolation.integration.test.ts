import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  getPoolMetrics: vi.fn().mockReturnValue({ totalCount: 5, idleCount: 4, waitingCount: 0 }),
}));

vi.mock("../services/workspaceService.js", () => ({
  getWorkspaceBySubdomain: vi.fn().mockImplementation(async (subdomain: string) => {
    if (subdomain === "campus-a" || subdomain === "campus-b") {
      return { id: 1, subdomain, enabled: true, madrasaName: "Campus Madrasa" };
    }
    return null;
  }),
}));

import { buildApp } from "../app.js";

describe("Faculty Module Multi-Tenant & Cross-Institution Boundary Tests", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
    process.env.MMS_APP_DOMAIN = "mms.local";
  });

  it("rejects unauthenticated requests to /api/faculty with 401 Unauthorized", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/faculty",
      headers: {
        host: "campus-a.mms.local",
      },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("rejects requests to /api/faculty missing tenant subdomain with 403 Forbidden", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({
      id: 1,
      email: "dean@campus-a.edu",
      workspaceSubdomain: "campus-a",
      role: "admin",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/faculty",
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

  it("rejects cross-tenant access when token institution does not match request institution host", async () => {
    const app = await buildApp();
    // Token issued for 'campus-a', but attacker sends request targeting 'campus-b'
    const token = app.jwt.sign({
      id: 1,
      email: "dean@campus-a.edu",
      workspaceSubdomain: "campus-a",
      role: "admin",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/faculty",
      headers: {
        host: "campus-b.mms.local",
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

  it("rejects cross-tenant write mutation attempts (POST /api/faculty) with 403 Forbidden", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({
      id: 1,
      email: "dean@campus-a.edu",
      workspaceSubdomain: "campus-a",
      role: "admin",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/faculty",
      headers: {
        host: "campus-b.mms.local",
        authorization: `Bearer ${token}`,
      },
      payload: {
        firstName: "Dr. Fatima",
        lastName: "Zahra",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Token is not valid for this workspace",
    });
    await app.close();
  });

  it("rejects platform_access superuser tokens on tenant faculty endpoints", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({
      id: 999,
      email: "platform@mms.local",
      workspaceSubdomain: "campus-a",
      tokenType: "platform_access",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/faculty",
      headers: {
        host: "campus-a.mms.local",
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

  it("rejects refresh tokens used as bearer tokens on faculty endpoints", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({
      id: 1,
      email: "dean@campus-a.edu",
      workspaceSubdomain: "campus-a",
      tokenType: "refresh",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/faculty",
      headers: {
        host: "campus-a.mms.local",
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
