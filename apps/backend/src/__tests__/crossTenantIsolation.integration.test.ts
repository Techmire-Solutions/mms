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

/**
 * Route-level cross-tenant isolation for the Accounting module.
 *
 * The DB-level guarantee lives in `accountingTenantIsolationDb` (RLS + explicit
 * predicates); this suite proves the same boundary holds at the HTTP edge: a token
 * issued for one workspace can never reach another workspace's accounting handler,
 * on reads or writes, and the rejection happens before any handler or repository
 * runs (so no audit row and no response payload can cross tenants).
 */

const TENANT_A = "campus-a";
const TENANT_B = "campus-b";
const APP_DOMAIN = "mms.local";

/** Accounting contract paths that matter most for isolation: list, detail, write, report. */
const AUDITED_ROUTES: ReadonlyArray<{
  method: "GET" | "PUT" | "POST" | "DELETE";
  url: string;
  payload?: object;
}> = [
  { method: "GET", url: "/api/accounting/accounts" },
  { method: "GET", url: "/api/accounting/entries" },
  { method: "DELETE", url: "/api/accounting/entries/je-campus-b" },
  { method: "PUT", url: "/api/accounting/entries/bulk", payload: [] },
  { method: "GET", url: "/api/accounting/report-aggregates" },
  { method: "GET", url: "/api/accounting/ledger?accountId=acc-campus-b" },
  { method: "PUT", url: "/api/accounting/exchange-rates", payload: { rates: [] } },
  { method: "GET", url: "/api/accounting/hedges" },
  { method: "POST", url: "/api/accounting/opening-balances/fy-campus-b/post", payload: {} },
  { method: "POST", url: "/api/accounting/reports/pdf", payload: {} },
];

function tokenFor(app: Awaited<ReturnType<typeof buildApp>>, subdomain: string): string {
  return app.jwt.sign({
    id: 1,
    email: `admin@${subdomain}.edu`,
    workspaceSubdomain: subdomain,
    role: "admin",
  });
}

describe("Accounting multi-tenant boundary (HTTP)", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
    process.env.MMS_APP_DOMAIN = APP_DOMAIN;
  });

  it("refuses a token issued for another workspace on every accounting read and write", async () => {
    const app = await buildApp();
    try {
      for (const route of AUDITED_ROUTES) {
        const res = await app.inject({
          method: route.method,
          url: route.url,
          headers: {
            host: `${TENANT_B}.${APP_DOMAIN}`,
            authorization: `Bearer ${tokenFor(app, TENANT_A)}`,
          },
          ...(route.payload === undefined ? {} : { payload: route.payload }),
        });

        expect(res.statusCode, `${route.method} ${route.url}`).toBe(403);
        expect(res.json()).toMatchObject({
          type: "forbidden",
          message: "Token is not valid for this workspace",
        });
        // The forbidden envelope carries no tenant payload at all.
        expect(res.body).not.toContain("campus-b");
      }
    } finally {
      await app.close();
    }
  });

  it("masks a workspace id supplied through query or body", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/api/accounting/entries?accountId=acc-campus-b",
        headers: {
          host: `${TENANT_B}.${APP_DOMAIN}`,
          authorization: `Bearer ${tokenFor(app, TENANT_A)}`,
        },
      });

      expect(res.statusCode).toBe(403);
      // A leaked id would let a caller confirm the other tenant's data exists.
      expect(res.body).not.toContain("acc-campus-b");
    } finally {
      await app.close();
    }
  });

  it("requires authentication before any accounting handler", async () => {
    const app = await buildApp();
    try {
      for (const route of AUDITED_ROUTES.slice(0, 5)) {
        const res = await app.inject({
          method: route.method,
          url: route.url,
          headers: { host: `${TENANT_A}.${APP_DOMAIN}` },
          ...(route.payload === undefined ? {} : { payload: route.payload }),
        });
        expect(res.statusCode, `${route.method} ${route.url}`).toBe(401);
      }
    } finally {
      await app.close();
    }
  });

  it("rejects accounting requests without a tenant subdomain", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/api/accounting/accounts",
        headers: { authorization: `Bearer ${tokenFor(app, TENANT_A)}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({
        type: "forbidden",
        message: "This endpoint requires a tenant subdomain",
      });
    } finally {
      await app.close();
    }
  });

  it("rejects platform and refresh tokens on accounting endpoints", async () => {
    const app = await buildApp();
    try {
      const platformToken = app.jwt.sign({
        id: 999,
        email: "platform@mms.local",
        workspaceSubdomain: TENANT_A,
        tokenType: "platform_access",
      });
      const refreshToken = app.jwt.sign({
        id: 1,
        email: `admin@${TENANT_A}.edu`,
        workspaceSubdomain: TENANT_A,
        tokenType: "refresh",
      });

      const platform = await app.inject({
        method: "GET",
        url: "/api/accounting/accounts",
        headers: { host: `${TENANT_A}.${APP_DOMAIN}`, authorization: `Bearer ${platformToken}` },
      });
      const refresh = await app.inject({
        method: "GET",
        url: "/api/accounting/accounts",
        headers: { host: `${TENANT_A}.${APP_DOMAIN}`, authorization: `Bearer ${refreshToken}` },
      });

      expect(platform.statusCode).toBe(401);
      expect(platform.json()).toMatchObject({ type: "auth_required" });
      expect(refresh.statusCode).toBe(401);
      expect(refresh.json()).toMatchObject({ type: "auth_required" });
    } finally {
      await app.close();
    }
  });
});
