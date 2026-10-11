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
 * A new route that matches neither table fails this suite.
 */
const NON_MODULE_ROUTES: ReadonlyArray<{ prefix: string; reason: string }> = [
  { prefix: "*", reason: "CORS preflight" },
  { prefix: "/health", reason: "ops probe" },
  { prefix: "/ready", reason: "ops probe" },
  { prefix: "/metrics", reason: "ops metrics" },
  { prefix: "/ws", reason: "live-update socket (keys only, no data)" },
  { prefix: "/api/ws", reason: "live-update socket (keys only, no data)" },
  { prefix: "/api/openapi.json", reason: "public API description" },
  { prefix: "/api/public/", reason: "unauthenticated deployment config" },
  { prefix: "/api/auth/", reason: "session, profile, and onboarding" },
  { prefix: "/api/platform/", reason: "platform console (authenticatePlatform)" },
  { prefix: "/api/workspace/", reason: "workspace registry and branding" },
  { prefix: "/api/workspaces/", reason: "workspace registry and branding" },
  { prefix: "/api/module-access", reason: "the availability snapshot itself" },
  {
    prefix: "/api/db/",
    reason: "settings objects incl. module management (settings.global.write)",
  },
  { prefix: "/api/email/", reason: "integration settings (settings.global.write)" },
  { prefix: "/api/sms/", reason: "integration settings (settings.global.write)" },
  { prefix: "/api/ai/", reason: "LLM provider settings" },
  { prefix: "/api/uploads/", reason: "module-agnostic attachment storage" },
  { prefix: "/api/audit/", reason: "audit governance (own permissions)" },
  {
    prefix: "/api/saved-reports",
    reason: "module resolved per request in-handler (getModuleAccessDenial)",
  },
  {
    prefix: "/api/background-jobs",
    reason: "owner-scoped tray; download gated in-handler, execution in worker",
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
        } else if (access || !NON_MODULE_ROUTES.some((c) => matchesPrefix(url, c.prefix))) {
          unclassified.push(key);
        }
      }
    }

    expect(collected.length).toBeGreaterThan(500);
    expect(ungated).toEqual([]);
    expect(unclassified).toEqual([]);
    expect([...modulesSeen].sort()).toEqual([...ACCESS_CONTROLLED_MODULE_IDS].sort());
  }, 60_000);
});
