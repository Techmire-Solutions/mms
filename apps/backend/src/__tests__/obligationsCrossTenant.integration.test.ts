import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken } from "./helpers/tokens.js";
import { getRequestTenant } from "../lib/tenantContext.js";

/**
 * Route-level cross-tenant isolation for the Obligations module.
 *
 * `obligationsTenantIsolation` proves the database boundary (RLS + explicit predicates). This suite
 * proves the boundary at the HTTP edge: the tenant every handler sees comes from the authenticated
 * request — never from a payload or a path id — so a token for one workspace can never act in
 * another one (test-suite audit G2). The named `crossTenantIsolation.integration.test.ts` covers
 * Accounting only; this is the obligations equivalent.
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

const TENANTS = new Set(["demo", "other"]);

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        TENANTS.has(subdomain)
          ? { id: `ws-${subdomain}`, subdomain, madrasaName: subdomain, enabled: true }
          : null,
      ),
  };
});

/** Captures the tenant each handler actually observes, then records the call. */
const calls: Array<{ handler: string; tenant: string | null; args: unknown[] }> = [];
function record(handler: string, args: unknown[]) {
  calls.push({ handler, tenant: getRequestTenant(), args });
}

vi.mock("../obligations/use-cases/obligationsUseCases.js", () => ({
  obligationsUseCases: {
    // The list handler wraps reads in the module's read wrapper; without it the mock throws.
    runObligationsRead: (work: () => Promise<unknown>) => work(),
    loadObligationTypes: vi.fn().mockResolvedValue([]),
    upsertObligationTypes: vi.fn(),
    loadMujtahids: vi.fn().mockResolvedValue([]),
    upsertMujtahids: vi.fn(),
    loadMujtahidReps: vi.fn().mockResolvedValue([]),
    upsertMujtahidReps: vi.fn(),
    loadWakalaTypes: vi.fn().mockResolvedValue([]),
    upsertWakalaTypes: vi.fn(),
    loadObligationDistributions: vi.fn().mockResolvedValue([]),
    upsertObligationDistributions: vi.fn(),
    loadObligationCollections: vi.fn().mockImplementation(async (...args: unknown[]) => {
      record("loadCollections", args);
      return [];
    }),
    upsertObligationCollections: vi.fn(),
    deleteObligationCollectionById: vi.fn().mockImplementation(async (...args: unknown[]) => {
      record("deleteCollection", args);
      return false;
    }),
    restoreObligationCollectionById: vi.fn().mockImplementation(async (...args: unknown[]) => {
      record("restoreCollection", args);
      return false;
    }),
    bulkSoftDeleteObligationCollections: vi.fn(),
    bulkRestoreObligationCollections: vi.fn(),
    loadObligationsCommandMetrics: vi.fn().mockResolvedValue({}),
    loadObligationsReportAggregates: vi.fn().mockResolvedValue({}),
    replaceObligationTypes: vi.fn(),
    replaceMujtahids: vi.fn(),
    replaceMujtahidReps: vi.fn(),
    replaceWakalaTypes: vi.fn(),
    replaceObligationDistributions: vi.fn(),
    replaceObligationCollections: vi.fn(),
    replaceWakalaAggregate: vi.fn(),
    loadObligationCollectionVoucher: vi.fn().mockImplementation(async (...args: unknown[]) => {
      record("loadVoucher", args);
      return null;
    }),
  },
}));

const OTHER_RECEIPT = "oc-other-tenant";

function token(app: Awaited<ReturnType<typeof buildApp>>, tenant: string) {
  return adminToken(app, { workspaceSubdomain: tenant });
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("obligations route-level tenant isolation", () => {
  it("scopes the collection list to the token's workspace", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: { host: "other.localhost", authorization: `Bearer ${token(app, "other")}` },
    });

    expect(res.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ handler: "loadCollections", tenant: "other" });
    await app.close();
  });

  it("keeps another workspace's receipt id inside the caller's own scope", async () => {
    // The caller is `demo`; the id belongs to `other`. The handler must pass `demo` as the tenant
    // and the id unchanged — the repository predicate (proven by the RLS suite) then finds nothing.
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/obligations/collections/${OTHER_RECEIPT}/voucher`,
      headers: { host: "demo.localhost", authorization: `Bearer ${token(app, "demo")}` },
    });

    expect(res.statusCode).toBe(404);
    expect(calls[0]).toMatchObject({ handler: "loadVoucher", tenant: "demo" });
    expect(calls[0]?.args[0]).toBe(OTHER_RECEIPT);
    await app.close();
  });

  it("audits a delete against the caller's workspace, never the receipt's", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/obligations/collections/${OTHER_RECEIPT}`,
      headers: { host: "demo.localhost", authorization: `Bearer ${token(app, "demo")}` },
      payload: {},
    });

    // Not found in the caller's workspace, and the tenant the handler saw was the caller's.
    expect(res.statusCode).toBe(404);
    expect(calls[0]).toMatchObject({ handler: "deleteCollection", tenant: "demo" });
    await app.close();
  });

  it("audits a restore against the caller's workspace too", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/obligations/collections/${OTHER_RECEIPT}/restore`,
      headers: { host: "demo.localhost", authorization: `Bearer ${token(app, "demo")}` },
      payload: {},
    });

    expect([404, 400]).toContain(res.statusCode);
    expect(calls[0]?.tenant).toBe("demo");
    await app.close();
  });

  it("runs the voucher lookup under the token's workspace when the tenant matches", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/obligations/collections/${OTHER_RECEIPT}/voucher`,
      headers: { host: "other.localhost", authorization: `Bearer ${token(app, "other")}` },
    });

    expect(res.statusCode).toBe(404); // mocked use case returns null
    expect(calls[0]).toMatchObject({ handler: "loadVoucher", tenant: "other" });
    await app.close();
  });

  it("rejects a token whose workspace disagrees with the request host before any handler runs", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: { host: "other.localhost", authorization: `Bearer ${token(app, "demo")}` },
    });

    expect(res.statusCode).not.toBe(200);
    expect(calls).toHaveLength(0);
    await app.close();
  });
});
