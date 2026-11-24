import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, RouteOptions } from "fastify";
import { userContract } from "@mms/contracts";

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

describe("users contract route coverage", () => {
  it("registers a handler for every userContract route", async () => {
    const app = await buildApp();
    await app.ready();
    await app.close();

    const registered = new Set<string>();
    for (const route of collected) {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) {
        registered.add(`${method.toUpperCase()} ${route.url}`);
      }
    }

    const missing: string[] = [];
    for (const [name, route] of Object.entries(userContract)) {
      // ts-rest route objects all carry `method` + `path` at runtime, but the
      // generated union type does not guarantee `path` on every member.
      const r = route as unknown as { method: string; path: string };
      const method = r.method.toUpperCase();
      const key = `${method} ${r.path}`;
      if (!registered.has(key)) {
        missing.push(`${name} → ${key}`);
      }
    }

    expect(missing).toEqual([]);
  }, 60_000);
});
