import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

/**
 * Behavioural route-permission matrix for the Platform Console — the most
 * privileged surface in the product. `moduleAccessCoverage.test.ts` only proves
 * each `/api/platform/*` path is *classified* as a non-module route; it does not
 * prove the route is gated. This suite enumerates the live route table and proves:
 *
 *   1. every route is classified here (a new route fails CI until it is),
 *   2. every non-public route answers 401 without a platform session,
 *   3. an area grant is required — a `workspaces`-only admin is 403 on every other
 *      area — and the super-user-only operations reject an admin holding every grant,
 *   4. the `onboard` grant is enforced separately from `workspaces`.
 *
 * Platform auth is cookie-only (`mms_platform_access`); `authenticatePlatform`
 * strips any Authorization header, so these tests never send one.
 */

const mockUsers = vi.hoisted(() => {
  const all = { workspaces: true, onboard: true, settings: true, admins: true, system: true };
  const user = (id: string, role: "super_user" | "admin", permissions: typeof all) => ({
    id,
    email: `${id}@platform.test`,
    name: id,
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role,
    permissions,
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  return {
    superUser: user("p-super", "super_user", all),
    allGrantsAdmin: user("p-admin-all", "admin", all),
    workspacesOnly: user("p-admin-ws", "admin", {
      ...all,
      onboard: false,
      settings: false,
      admins: false,
      system: false,
    }),
    onboardOnly: user("p-admin-onboard", "admin", {
      ...all,
      workspaces: false,
      settings: false,
      admins: false,
      system: false,
    }),
    noWorkspaces: user("p-admin-no-ws", "admin", { ...all, workspaces: false }),
    noSettings: user("p-admin-no-settings", "admin", { ...all, settings: false }),
    noAdmins: user("p-admin-no-admins", "admin", { ...all, admins: false }),
    noSystem: user("p-admin-no-system", "admin", { ...all, system: false }),
    noOnboard: user("p-admin-no-onboard", "admin", { ...all, onboard: false }),
    noSettingsNoOnboard: user("p-admin-no-settings-onboard", "admin", {
      ...all,
      settings: false,
      onboard: false,
    }),
  };
});
type MockUser = (typeof mockUsers)[keyof typeof mockUsers];

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => {
  const byId = new Map<string, unknown>(Object.values(mockUsers).map((user) => [user.id, user]));
  return {
    findPlatformUserRowById: vi.fn().mockImplementation(async (id: string) => byId.get(id) ?? null),
    findPlatformUserRowByEmail: vi.fn().mockResolvedValue(null),
    listPlatformUsers: vi.fn().mockResolvedValue([...byId.values()]),
    updatePlatformUserRow: vi.fn().mockResolvedValue(mockUsers.superUser),
  };
});

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

type Area =
  | "workspaces"
  | "onboard"
  | "settings"
  | "settings_or_onboard"
  | "admins"
  | "system"
  | "authenticated"
  | "optional"
  | "public";

/**
 * Path → required permission. `authenticated` = any platform session (self-service
 * session/password routes); `optional` = session read that also answers 200 anonymously
 * (`GET /auth/me`); `public` = no session (login, setup, 2FA, password reset).
 */
const ROUTE_AREAS: ReadonlyArray<{ pattern: RegExp; area: Area }> = [
  // Public auth surface.
  {
    pattern: /^\/api\/platform\/auth\/(login|logout|setup\/status|setup\/register)$/,
    area: "public",
  },
  { pattern: /^\/api\/platform\/auth\/2fa\/(verify|resend)$/, area: "public" },
  { pattern: /^\/api\/platform\/auth\/password\/(forgot|resend|reset)$/, area: "public" },
  { pattern: /^\/api\/auth\/onboarding-status$/, area: "public" },
  // Platform-gated onboarding (the tenant-auth prefix carries a platform permission).
  { pattern: /^\/api\/auth\/onboard$/, area: "onboard" },
  // Self-service session routes.
  { pattern: /^\/api\/platform\/auth\/me$/, area: "optional" },
  // The session policy is reference information (TOTP/idle windows), not user data.
  { pattern: /^\/api\/platform\/auth\/session\/policy$/, area: "public" },
  { pattern: /^\/api\/platform\/auth\/(session\/extend|change-password)$/, area: "authenticated" },
  // Areas.
  { pattern: /^\/api\/platform\/(users|admins)(\/|$)/, area: "admins" },
  { pattern: /^\/api\/platform\/(workspaces|consolidation)(\/|$)/, area: "workspaces" },
  { pattern: /^\/api\/platform\/modules\/catalog$/, area: "settings_or_onboard" },
  {
    pattern:
      /^\/api\/platform\/(email|sms|settings|branding|llm|backup|modules(?!\/catalog))(\/|$)/,
    area: "settings",
  },
  { pattern: /^\/api\/platform\/(admin\/system|schema|ai|audit)(\/|$)/, area: "system" },
];

/**
 * Operations that require the platform super-user role, not just a grantable
 * permission (verified in the handlers: `requirePlatformSuperUser` and the inline
 * `role !== "super_user"` check on workspace deletion).
 */
const SUPER_USER_ONLY = new Set([
  "POST /api/platform/admin/system/migrate-and-restart",
  "DELETE /api/platform/workspaces/:subdomain",
  "POST /api/platform/workspaces/:subdomain/reset-admin-password",
  "POST /api/platform/workspaces/:subdomain/admin-users",
  "POST /api/platform/users",
  "DELETE /api/platform/users/:adminId",
  "PATCH /api/platform/users/:adminId/disabled",
  "PATCH /api/platform/users/:adminId/permissions",
  "PUT /api/platform/modules",
  "PUT /api/platform/llm",
  "POST /api/platform/llm/test",
  "POST /api/platform/llm/models",
  "POST /api/platform/backup/export",
  "POST /api/platform/backup/import",
]);

/** Routes registered outside `/api/platform` that still carry a platform permission. */
const EXTRA_PLATFORM_ROUTES = ["POST /api/auth/onboard"] as const;

function expandSegment(segment: string): string[] {
  const [first = "", ...rest] = segment.split("|");
  const lead = first.startsWith("/") ? "/" : "";
  return [first, ...rest.map((alt) => (alt.startsWith("/") ? alt : `${lead}${alt}`))];
}

/** `printRoutes` tree → "METHOD /full/path" keys (param siblings expanded). */
function routeKeys(tree: string): string[] {
  const out: string[] = [];
  const stack: { indent: number; paths: string[] }[] = [];
  for (const line of tree.split("\n")) {
    const node = line.match(/^([│├└─\s]*)(\S+) \(([A-Z, ]+)\)\s*$/);
    if (!node) continue;
    const indent = node[1].length;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parents = stack[stack.length - 1]?.paths ?? [""];
    const paths = parents.flatMap((parent) =>
      expandSegment(node[2]).map((seg) => `${parent}${seg}`),
    );
    stack.push({ indent, paths });
    for (const method of node[3].split(",")) {
      for (const path of paths) out.push(`${method.trim()} ${path}`);
    }
  }
  return out;
}

function areaFor(path: string): Area | undefined {
  const matches = ROUTE_AREAS.filter((rule) => rule.pattern.test(path));
  return matches.length === 1 ? matches[0].area : undefined;
}

describe("platform route security matrix", () => {
  let app: FastifyInstance;
  let platformRoutes: string[] = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
    const HEAD = new Set(["HEAD", "OPTIONS"]);
    platformRoutes = routeKeys(app.printRoutes({ commonPrefix: false }))
      .filter((key) => {
        const [method, path] = key.split(" ");
        if (!method || !path || HEAD.has(method)) return false;
        return path.startsWith("/api/platform/") || EXTRA_PLATFORM_ROUTES.includes(key as never);
      })
      .sort();
  });

  afterAll(async () => {
    await app?.close();
  });

  function signToken(user: MockUser): string {
    return app.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      sessionVersion: user.sessionVersion,
      tokenType: "platform_access",
    });
  }

  async function call(key: string, user?: MockUser): Promise<number> {
    const [method, path] = key.split(" ");
    const res = await app.inject({
      method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      url: path.replace(/:[A-Za-z0-9_]+/g, "probe-id"),
      headers: { origin: "http://localhost" },
      ...(user ? { cookies: { mms_platform_access: signToken(user) } } : {}),
      ...(method === "GET" || method === "DELETE" ? {} : { payload: {} }),
    });
    return res.statusCode;
  }

  it("classifies every platform route exactly once", () => {
    expect(platformRoutes.length).toBeGreaterThan(35);
    const unclassified = platformRoutes.filter((key) => !areaFor(key.split(" ")[1] ?? ""));
    expect(unclassified, `unclassified: ${unclassified.join(", ")}`).toEqual([]);
    const ambiguous = platformRoutes.filter(
      (key) => ROUTE_AREAS.filter((r) => r.pattern.test(key.split(" ")[1] ?? "")).length !== 1,
    );
    expect(ambiguous, `ambiguous: ${ambiguous.join(", ")}`).toEqual([]);
  });

  it("answers 401 without a platform session on every gated route", async () => {
    for (const key of platformRoutes) {
      const area = areaFor(key.split(" ")[1] ?? "");
      if (area === "public" || area === "optional") continue;
      expect(await call(key), key).toBe(401);
    }
  });

  it("denies every route to an admin missing that route's area grant", async () => {
    const withoutArea: Record<string, MockUser> = {
      workspaces: mockUsers.noWorkspaces,
      onboard: mockUsers.noOnboard,
      settings: mockUsers.noSettings,
      settings_or_onboard: mockUsers.noSettingsNoOnboard,
      admins: mockUsers.noAdmins,
      system: mockUsers.noSystem,
    };
    for (const key of platformRoutes) {
      const area = areaFor(key.split(" ")[1] ?? "");
      if (!area || area === "public" || area === "optional" || area === "authenticated") continue;
      const user = SUPER_USER_ONLY.has(key) ? mockUsers.allGrantsAdmin : withoutArea[area];
      expect(user, `no fixture for ${area}`).toBeDefined();
      expect(await call(key, user as MockUser), `${key} (missing ${area})`).toBe(403);
    }
    // The grant must also not over-deny: a workspaces-only admin reaches workspace reads.
    expect(await call("GET /api/platform/workspaces", mockUsers.workspacesOnly)).not.toBe(403);
  });

  it("keeps the super-user-only surface closed to an admin holding every grant", async () => {
    for (const key of SUPER_USER_ONLY) {
      expect(platformRoutes, `${key} must exist`).toContain(key);
      expect(await call(key, mockUsers.allGrantsAdmin), `${key} (admin, all grants)`).toBe(403);
    }
    // The same surface is reachable for the super user (read-only probe).
    expect(await call("GET /api/platform/users", mockUsers.superUser)).not.toBe(403);
  });

  it("keeps the session probe anonymous-safe by design", async () => {
    // Classified `optional`: the UI needs to know whether a platform session exists
    // without treating "no session" as an error.
    expect(areaFor("/api/platform/auth/me")).toBe("optional");
    expect(await call("GET /api/platform/auth/me")).toBe(200);
  });

  it("pins the onboard grant separately from workspaces", async () => {
    const onboardKey = "POST /api/auth/onboard";
    expect(platformRoutes).toContain(onboardKey);
    expect(areaFor("/api/auth/onboard")).toBe("onboard");
    expect(await call(onboardKey, mockUsers.workspacesOnly)).toBe(403);
    expect(await call(onboardKey, mockUsers.onboardOnly)).not.toBe(403);
    expect(await call(onboardKey)).toBe(401);
  });
});
