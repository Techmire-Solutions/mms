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

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
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
});
