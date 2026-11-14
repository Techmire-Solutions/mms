import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, adminToken, auditorToken, teacherToken } from "./helpers/tokens.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { normalizeObligationsModulePreferences } from "@mms/shared";

/**
 * HTTP coverage for the catalogue and preferences routes.
 *
 * Nine of the twenty obligations contract paths had no `inject` test at all: every catalogue list,
 * every catalogue bulk write, and the preferences pair — the only route gated on the module's setup
 * privilege rather than `obligations.write` (test-suite audit 2, G1). The route-injection ratchet
 * (`check:obligations-route-injection`) keeps them covered.
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
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo"
          ? { id: "ws-demo", subdomain: "demo", madrasaName: "Demo", enabled: true }
          : null,
      ),
  };
});

// `vi.mock` factories are hoisted, so everything they close over must be hoisted too.
const harness = vi.hoisted(() => ({
  calls: [] as Array<{ handler: string; tenant: string | null; args: unknown[] }>,
}));
const calls = harness.calls;
function record(handler: string, args: unknown[]) {
  calls.push({ handler, tenant: getRequestTenant(), args });
}

const preferences = vi.hoisted(() => ({
  getObligationPreferencesService: vi.fn(),
  updateObligationPreferencesService: vi.fn(),
}));
vi.mock("../services/obligationPreferencesService.js", () => ({
  getObligationPreferencesService: async () => {
    preferences.getObligationPreferencesService();
    record("getPreferences", []);
    return {};
  },
  updateObligationPreferencesService: async (...args: unknown[]) => {
    preferences.updateObligationPreferencesService(...args);
    record("updatePreferences", args);
    // The response is contract-validated: return the normalized shape the real service returns.
    return normalizeObligationsModulePreferences({});
  },
}));

vi.mock("../obligations/use-cases/obligationsUseCases.js", () => {
  const load = (handler: string) =>
    vi.fn().mockImplementation(async (...args: unknown[]) => {
      record(handler, args);
      return [];
    });
  const save = (handler: string) =>
    vi.fn().mockImplementation(async (...args: unknown[]) => {
      record(handler, args);
      return [];
    });
  return {
    obligationsUseCases: {
      runObligationsRead: (work: () => Promise<unknown>) => work(),
      loadObligationTypes: load("loadTypes"),
      replaceObligationTypes: save("replaceTypes"),
      loadMujtahids: load("loadMujtahids"),
      replaceMujtahids: save("replaceMujtahids"),
      loadMujtahidReps: load("loadReps"),
      replaceMujtahidReps: save("replaceReps"),
      loadWakalaTypes: load("loadWakala"),
      replaceWakalaTypes: save("replaceWakala"),
      loadObligationDistributions: load("loadDistributions"),
      replaceObligationDistributions: save("replaceDistributions"),
      loadObligationCollections: load("loadCollections"),
      upsertObligationCollections: save("saveCollections"),
      deleteObligationCollectionById: vi.fn(),
      restoreObligationCollectionById: vi.fn(),
      bulkSoftDeleteObligationCollections: vi.fn(),
      bulkRestoreObligationCollections: vi.fn(),
      loadObligationsCommandMetrics: vi.fn().mockResolvedValue({}),
      loadObligationsReportAggregates: vi.fn().mockResolvedValue({}),
      replaceObligationCollections: vi.fn(),
      replaceWakalaAggregate: vi.fn(),
      loadObligationCollectionVoucher: vi.fn().mockResolvedValue(null),
    },
  };
});

const headers = (token: string) => ({ host: "demo.localhost", authorization: `Bearer ${token}` });

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});
afterEach(() => {
  calls.length = 0;
});

describe.each([
  ["/api/obligations/types", "loadTypes"],
  ["/api/obligations/mujtahids", "loadMujtahids"],
  ["/api/obligations/distributions", "loadDistributions"],
  ["/api/obligations/reps", "loadReps"],
  ["/api/obligations/wakala", "loadWakala"],
])("GET %s", (url, handler) => {
  it("serves a reader and scopes the read to the caller's workspace", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url, headers: headers(auditorToken(app)) });

    expect(res.statusCode).toBe(200);
    expect(calls[0]).toMatchObject({ handler, tenant: "demo" });
    await app.close();
  });

  it("refuses a role without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url,
      headers: {
        host: "demo.localhost",
        // A role with no obligations grant at all.
        authorization: `Bearer ${tenantLessToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(calls).toHaveLength(0);
    await app.close();
  });
});

describe.each([
  ["/api/obligations/types/bulk", "replaceTypes"],
  ["/api/obligations/mujtahids/bulk", "replaceMujtahids"],
  ["/api/obligations/wakala/bulk", "replaceWakala"],
  ["/api/obligations/distributions/bulk", "replaceDistributions"],
])("PUT %s", (url, handler) => {
  it("lets a writer save and passes the caller's workspace", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url,
      headers: headers(accountantToken(app)),
      payload: [],
    });

    expect(res.statusCode).toBe(200);
    expect(calls[0]).toMatchObject({ handler, tenant: "demo" });
    await app.close();
  });

  it("refuses a read-only role before the save runs", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url,
      headers: headers(auditorToken(app)),
      payload: [],
    });

    expect(res.statusCode).toBe(403);
    expect(calls).toHaveLength(0);
    await app.close();
  });

  it("rejects a malformed body with 400 before any save", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url,
      headers: headers(accountantToken(app)),
      payload: { not: "an array" },
    });

    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
    await app.close();
  });
});

describe("preferences", () => {
  it("serves the module preferences to a reader", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/preferences",
      headers: headers(auditorToken(app)),
    });

    expect(res.statusCode).toBe(200);
    expect(calls[0]).toMatchObject({ handler: "getPreferences", tenant: "demo" });
    await app.close();
  });

  it("refuses a writer without the setup privilege", async () => {
    // `obligations.write` records receipts; editing module setup needs `settings.global.write`.
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/obligations/preferences",
      headers: headers(accountantToken(app)),
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(preferences.updateObligationPreferencesService).not.toHaveBeenCalled();
    await app.close();
  });

  it("lets an admin update the setup preferences", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/obligations/preferences",
      headers: headers(adminToken(app)),
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(preferences.updateObligationPreferencesService).toHaveBeenCalled();
    await app.close();
  });
});

/** A signed token whose role carries no obligations permission (teachers have none by default). */
function tenantLessToken(app: Awaited<ReturnType<typeof buildApp>>): string {
  return teacherToken(app, { workspaceSubdomain: "demo" });
}
