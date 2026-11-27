import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { buildApp } from "../app.js";
import { accountantToken, adminToken, auditorToken, guardianToken } from "./helpers/tokens.js";

/**
 * Behavioural RBAC matrix over the accounting contract.
 *
 * `check-accounting-route-security.mjs` keeps `accounting-route-security.json`
 * complete (every contract route classified, no stale entries); this suite proves
 * the running server enforces it: unauthenticated calls are 401, and every role
 * the matrix marks as denied gets 403 **before any handler runs**. Allowed-role
 * happy paths are pinned by the per-family inject suites, so this matrix stays
 * mock-free and fast (denials never reach a repository).
 */

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/auth/authArtifactService.js")>()),
  deleteRefreshTokensForUser: vi.fn(),
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),

  authArtifactUserScopeKey: vi.fn(() => ""),
  authArtifactWorkspaceScopeKey: vi.fn(() => ""),
  deleteAuthArtifact: vi.fn().mockResolvedValue(undefined),
  findAuthArtifactByLookupKey: vi.fn().mockResolvedValue(null),
  tryClaimAuthArtifactByLookupKey: vi.fn().mockResolvedValue(null),
  updateAuthArtifactPayload: vi.fn().mockResolvedValue(undefined),
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

type MatrixEntry = {
  action: "read" | "write" | "delete" | "manage" | "setupWrite";
  deniedRoles: string[];
};

const matrix = JSON.parse(
  fs.readFileSync(
    new URL("../../../../scripts/ci/accounting-route-security.json", import.meta.url),
    "utf8",
  ),
) as Record<string, MatrixEntry>;
const ROUTES = Object.entries(matrix);

/**
 * Posting-authority rule (mirrors the `canManageAccounting` docstring in
 * `lib/rbacCanModuleHelpers.ts`): `accounting.manage` is controller authority over
 * period-end and immutable controls only. Routine posting — journal drafts and the
 * whole hedge lifecycle — is `accounting.write`. Moving a route in or out of this
 * list is a deliberate policy change: update it with a reason, the docstring, and
 * `docs/accounting-module-bug-review-2026-11-14.md` together.
 */
const CONTROLLER_AUTHORITY_ROUTES = new Map<string, string>([
  ["POST /api/accounting/entries/:id/reverse", "reversal of an immutable posted voucher"],
  ["POST /api/accounting/fiscal-years/:id/close", "fiscal-year close"],
  ["POST /api/accounting/fx-revaluations", "IAS 21 year-end revaluation"],
  ["POST /api/accounting/ias29-restatements", "IAS 29 restatement"],
  ["POST /api/accounting/opening-balances/:fiscalYearId/post", "opening-balance posting"],
  ["POST /api/accounting/posting-periods/:id/close", "posting-period close"],
  ["POST /api/accounting/posting-periods/:id/reopen", "posting-period reopen"],
  ["PUT /api/accounting/voucher-numbering", "voucher-numbering configuration"],
]);

/** Routine posting that must stay on `accounting.write`, not controller authority. */
const HEDGE_WRITE_ROUTES = [
  "POST /api/accounting/hedges",
  "POST /api/accounting/hedges/:id/valuations",
  "POST /api/accounting/hedges/:id/reclassify",
  "POST /api/accounting/hedges/:id/settle",
  "POST /api/accounting/hedges/:id/discontinue",
] as const;

const TOKENS = {
  admin: adminToken,
  accountant: accountantToken,
  auditor: auditorToken,
  guardian: guardianToken,
} as const;

/** `:id`-style placeholders become a harmless concrete value. */
const urlFor = (path: string) => path.replace(/:[A-Za-z0-9_]+/g, "probe-id");

const appPromise = buildApp();

async function inject(
  method: string,
  url: string,
  token?: (app: Awaited<typeof appPromise>) => string,
) {
  const app = await appPromise;
  const res = await app.inject({
    method: method as "GET" | "POST" | "PUT" | "DELETE",
    url,
    headers: {
      host: "demo.localhost",
      ...(token ? { authorization: `Bearer ${token(app)}` } : {}),
    },
  });
  return res;
}

describe("accounting route security matrix", () => {
  beforeAll(async () => {
    // Register the whole module surface once; every denial short-circuits the handler.
    await appPromise;
  });

  afterAll(async () => {
    const app = await appPromise;
    await app.close();
  });

  it("classifies every accounting contract route", () => {
    expect(ROUTES.length).toBeGreaterThan(50);
    for (const [key, entry] of ROUTES) {
      expect(entry.deniedRoles.length, key).toBeGreaterThan(0);
    }
  });

  it("answers 401 to an unauthenticated request on every route", async () => {
    for (const [key] of ROUTES) {
      const [method, path] = key.split(" ");
      const res = await inject(method, urlFor(path));
      expect(res.statusCode, key).toBe(401);
    }
  });

  it("denies every role the matrix marks, before any handler runs", async () => {
    for (const [key, entry] of ROUTES) {
      const [method, path] = key.split(" ");
      const url = urlFor(path);

      const guardian = await inject(method, url, TOKENS.guardian);
      expect(guardian.statusCode, `${key} (guardian)`).toBe(403);

      for (const role of entry.deniedRoles) {
        if (role === "guardian") continue;
        const res = await inject(method, url, TOKENS[role as keyof typeof TOKENS]);
        expect(res.statusCode, `${key} (${role})`).toBe(403);
      }
    }
  });

  it("does not deny the admin role on any classified route", async () => {
    for (const [key, entry] of ROUTES) {
      expect(entry.deniedRoles, key).not.toContain("admin");
    }
  });

  it("keeps `manage` limited to the documented controller-authority routes", () => {
    const manageRoutes = ROUTES.filter(([, entry]) => entry.action === "manage").map(
      ([key]) => key,
    );

    // Exact set equality both ways: a new `manage` route, or a downgrade, must be
    // a deliberate edit here plus the docstring + doc update.
    expect([...manageRoutes].sort()).toEqual([...CONTROLLER_AUTHORITY_ROUTES.keys()].sort());
    expect(CONTROLLER_AUTHORITY_ROUTES.size).toBe(manageRoutes.length);
  });

  it("keeps the hedge lifecycle on routine `write` posting", () => {
    for (const key of HEDGE_WRITE_ROUTES) {
      expect(matrix[key], key).toBeDefined();
      expect(matrix[key]?.action, key).toBe("write");
      // Accountants post these; only read-only roles and guardians are denied.
      expect(matrix[key]?.deniedRoles, key).not.toContain("accountant");
    }
  });
});
