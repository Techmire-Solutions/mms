import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, RouteOptions } from "fastify";
import { ACCESS_CONTROLLED_MODULE_IDS } from "@mms/shared";

const collected: RouteOptions[] = [];

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../routes/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../routes/index.js")>();
  return {
    registerRoutes: async (app: FastifyInstance) => {
      app.addHook("onRoute", (route) => {
        collected.push(route);
      });
      await actual.registerRoutes(app);
    },
  };
});

import { buildApp } from "../app.js";

/** URL prefix → owning module. Every route under one must be gated for that module. */
const MODULE_ROUTE_PREFIXES: Readonly<Record<string, string>> = {
  "/api/accounting": "accounting",
  "/api/attendance": "attendance",
  "/api/contacts": "contacts",
  "/api/dashboard": "dashboard",
  "/api/enrollments": "enrollment",
  "/api/examinations": "examination",
  "/api/faculty": "faculty",
  "/api/tenant/faculty": "faculty",
  "/api/v1/tenant/faculty": "faculty",
  "/api/finance": "finance",
  "/api/hasanat": "hasanat",
  "/api/messaging": "messaging",
  "/api/obligations": "obligations",
  "/api/question-bank": "questionBank",
  "/api/sessions": "sessions",
  "/api/students": "students",
  "/api/tasks": "tasks",
  "/api/users": "users",
};

/**
 * Explicitly classified non-module routes and why they are not module-gated.
 *
 * `paths` lists every URL served under the prefix (HEAD siblings implied). A new
 * endpoint under an allowlisted prefix fails this suite until it is added here
 * and reviewed for authorization — a broad prefix can no longer hide an
 * ungated route. A listed path that no longer exists also fails, so exemptions
 * cannot go stale.
 */
const NON_MODULE_ROUTES: ReadonlyArray<{
  prefix: string;
  reason: string;
  paths: readonly string[];
}> = [
  { prefix: "*", reason: "CORS preflight", paths: ["*"] },
  { prefix: "/health", reason: "ops probe", paths: ["/health"] },
  { prefix: "/ready", reason: "ops probe", paths: ["/ready"] },
  { prefix: "/metrics", reason: "ops metrics", paths: ["/metrics"] },
  {
    prefix: "/ws",
    reason: "live-update socket (keys only, no data)",
    paths: ["/ws"],
  },
  {
    prefix: "/api/ws",
    reason: "live-update socket (keys only, no data)",
    paths: ["/api/ws"],
  },
  { prefix: "/api/openapi.json", reason: "public API description", paths: ["/api/openapi.json"] },
  {
    prefix: "/api/public/",
    reason:
      "unauthenticated deployment config and public registration (subdomain-scoped, PII-free)",
    paths: [
      "/api/public/deployment-config",
      "/api/public/registrations",
      "/api/public/registrations/:slug",
    ],
  },
  {
    prefix: "/api/auth/",
    reason: "session, profile, and onboarding",
    paths: [
      "/api/auth/institution-setup-status",
      "/api/auth/me",
      "/api/auth/me/ui-state",
      "/api/auth/me/contact",
      "/api/auth/onboarding-status",
      "/api/auth/profile",
      "/api/auth/2fa/resend",
      "/api/auth/2fa/verify",
      "/api/auth/change-password",
      "/api/auth/forgot-password",
      "/api/auth/forgot-password/reset",
      "/api/auth/forgot-password/verify",
      "/api/auth/handoff",
      "/api/auth/login",
      "/api/auth/login-email/confirm",
      "/api/auth/login-email/request",
      "/api/auth/logout",
      "/api/auth/onboard",
      "/api/auth/refresh",
      "/api/auth/session/extend",
      "/api/auth/verify-password",
    ],
  },
  {
    prefix: "/api/platform/",
    reason: "platform console (authenticatePlatform)",
    paths: [
      "/api/platform/admin/system/activity-logs",
      "/api/platform/admin/system/activity-trend",
      "/api/platform/admin/system/telemetry",
      "/api/platform/admin/system/migrate-and-restart",
      "/api/platform/ai/query",
      "/api/platform/auth/me",
      "/api/platform/auth/session/policy",
      "/api/platform/auth/setup/status",
      "/api/platform/auth/setup/register",
      "/api/platform/auth/2fa/resend",
      "/api/platform/auth/2fa/verify",
      "/api/platform/auth/change-password",
      "/api/platform/auth/login",
      "/api/platform/auth/logout",
      "/api/platform/auth/password/forgot",
      "/api/platform/auth/password/resend",
      "/api/platform/auth/password/reset",
      "/api/platform/auth/session/extend",
      "/api/platform/email/integration",
      "/api/platform/email/integration/test",
      "/api/platform/schema/erd",
      "/api/platform/settings",
      "/api/platform/sms/integration",
      "/api/platform/sms/integration/test",
      "/api/platform/users",
      "/api/platform/users/:adminId",
      "/api/platform/users/:adminId/disabled",
      "/api/platform/users/:adminId/permissions",
      "/api/platform/users/:adminId/verify-email",
      "/api/platform/workspaces",
      "/api/platform/workspaces/:subdomain",
      "/api/platform/workspaces/:subdomain/modules",
      "/api/platform/workspaces/:subdomain/email-verification",
      "/api/platform/workspaces/:subdomain/admin-users",
      "/api/platform/workspaces/:subdomain/reset-admin-password",
      "/api/platform/workspaces/:subdomain/users/:userId/verify-email",
      "/api/platform/workspaces/metrics",
    ],
  },
  {
    prefix: "/api/workspace/",
    reason: "workspace registry and branding",
    paths: [
      "/api/workspace/by-subdomain/:subdomain",
      "/api/workspace/current",
      "/api/workspace/public-branding",
      "/api/workspace/registry",
      "/api/workspace/subdomain-available/:subdomain",
    ],
  },
  {
    prefix: "/api/workspaces/",
    reason: "workspace registry and branding",
    paths: [
      "/api/workspaces/by-subdomain/:subdomain",
      "/api/workspaces/current",
      "/api/workspaces/public-branding",
      "/api/workspaces/registry",
      "/api/workspaces/subdomain-available/:subdomain",
    ],
  },
  {
    prefix: "/api/module-access",
    reason: "the availability snapshot itself",
    paths: ["/api/module-access"],
  },
  {
    prefix: "/api/db/",
    reason: "settings objects incl. module management (settings.global.write)",
    paths: [
      "/api/db/backup",
      "/api/db/collections/:name",
      "/api/db/objects/:key",
      "/api/db/sync",
      "/api/db/reset",
    ],
  },
  {
    prefix: "/api/email/",
    reason: "integration settings (settings.global.write)",
    paths: [
      "/api/email/integration",
      "/api/email/integration/test",
      "/api/email/verification-code",
    ],
  },
  {
    prefix: "/api/sms/",
    reason: "integration settings (settings.global.write)",
    paths: ["/api/sms/integration", "/api/sms/integration/test"],
  },
  {
    prefix: "/api/ai/",
    reason: "LLM provider settings",
    paths: ["/api/ai/models", "/api/ai/test"],
  },
  {
    prefix: "/api/uploads/",
    reason: "module-agnostic attachment storage",
    paths: ["/api/uploads/attachment", "/api/uploads/image"],
  },
  {
    prefix: "/api/audit/",
    reason: "audit governance (own permissions)",
    paths: [
      "/api/audit/anomalies",
      "/api/audit/events",
      "/api/audit/export",
      "/api/audit/merkle-roots",
      "/api/audit/erasure",
      "/api/audit/retention/evaluate",
      "/api/audit/verify",
    ],
  },
  {
    prefix: "/api/saved-reports",
    reason: "module resolved per request in-handler (getModuleAccessDenial)",
    paths: ["/api/saved-reports", "/api/saved-reports/:id", "/api/saved-reports/:id/run"],
  },
  {
    prefix: "/api/background-jobs",
    reason: "owner-scoped tray; download gated in-handler, execution in worker",
    paths: [
      "/api/background-jobs",
      "/api/background-jobs/",
      "/api/background-jobs/:id",
      "/api/background-jobs/:id/download",
      "/api/background-jobs/clear-finished",
    ],
  },
  {
    prefix: "/api/templates",
    reason:
      "generic document template layout persistence (invoices, student cards, report cards, vouchers)",
    paths: ["/api/templates/:key"],
  },
];

function matchesPrefix(url: string, prefix: string): boolean {
  if (prefix === "*") return url === "*";
  return prefix.endsWith("/")
    ? url.startsWith(prefix)
    : url === prefix || url.startsWith(`${prefix}/`);
}

function moduleFor(url: string): string | undefined {
  const prefix = Object.keys(MODULE_ROUTE_PREFIXES)
    .filter((p) => matchesPrefix(url, p))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? MODULE_ROUTE_PREFIXES[prefix] : undefined;
}

/** Param siblings print as `/:id|:facultyId`; expand them into separate segments. */
function expandSegment(segment: string): string[] {
  const [first = "", ...rest] = segment.split("|");
  const lead = first.startsWith("/") ? "/" : "";
  return [first, ...rest.map((alt) => (alt.startsWith("/") ? alt : `${lead}${alt}`))];
}

/** `printRoutes({ includeHooks })` tree → "METHOD /full/path" → preHandler names. */
function preHandlersByRoute(tree: string): Map<string, string> {
  const out = new Map<string, string>();
  const stack: { indent: number; paths: string[] }[] = [];
  let current: string[] = [];
  for (const line of tree.split("\n")) {
    const node = line.match(/^([│├└─\s]*)(\S+) \(([A-Z, ]+)\)\s*$/);
    if (node) {
      const indent = node[1].length;
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const parents = stack[stack.length - 1]?.paths ?? [""];
      const paths = parents.flatMap((parent) =>
        expandSegment(node[2]).map((seg) => `${parent}${seg}`),
      );
      stack.push({ indent, paths });
      current = node[3].split(",").flatMap((m) => paths.map((path) => `${m.trim()} ${path}`));
      continue;
    }
    const hooks = line.match(/\(preHandler\) (\[.*\])/);
    if (hooks) for (const key of current) out.set(key, hooks[1]);
  }
  return out;
}

describe("module access coverage", () => {
  it("classifies every route and gates every module-owned route", async () => {
    const app = await buildApp();
    await app.ready();
    const hooks = preHandlersByRoute(app.printRoutes({ includeHooks: true, commonPrefix: false }));
    await app.close();

    const unclassified: string[] = [];
    const ungated: string[] = [];
    const modulesSeen = new Set<string>();

    for (const route of collected) {
      const url = route.url;
      for (const method of [route.method].flat()) {
        const key = `${method} ${url}`;
        const expected = moduleFor(url);
        const access = route.config?.moduleAccess;
        if (expected) {
          modulesSeen.add(expected);
          const guarded = hooks.get(key)?.includes("moduleAccessGuard") ?? false;
          if (access?.moduleId !== expected || !access.action || !guarded) {
            ungated.push(`${key} → stamped ${access?.moduleId ?? "none"}, guard ${guarded}`);
          }
        } else {
          const entry = NON_MODULE_ROUTES.find((c) => matchesPrefix(url, c.prefix));
          if (access || !entry || !entry.paths.includes(url)) {
            unclassified.push(key);
          }
        }
      }
    }

    // No stale exemptions: every listed non-module path must actually be served.
    const liveNonModuleUrls = new Set(collected.map((r) => r.url).filter((url) => !moduleFor(url)));
    const listedPaths = NON_MODULE_ROUTES.flatMap((c) => c.paths).filter((p) => p !== "*");
    const stale = [...new Set(listedPaths)].filter((p) => !liveNonModuleUrls.has(p));

    expect(collected.length).toBeGreaterThan(500);
    expect(ungated).toEqual([]);
    expect(unclassified).toEqual([]);
    expect(stale).toEqual([]);
    expect([...modulesSeen].sort()).toEqual([...ACCESS_CONTROLLED_MODULE_IDS].sort());
  }, 60_000);
});
