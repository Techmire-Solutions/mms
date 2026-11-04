/**
 * Faculty contract ↔ route parity.
 *
 * `@ts-rest/fastify` registers only the endpoints present in the implementation
 * object, so a contract endpoint without a router entry is silently skipped: its
 * declared request/response schemas are never enforced and the drift is
 * invisible to the type checker (the router is cast to `RouterImplementation`).
 * This spec boots the real app and requires every contract endpoint to resolve
 * to a registered route — the generic registrars included.
 */
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { facultyContract } from "@mms/shared";

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

interface ContractEndpoint {
  method: string;
  path: string;
}

function contractEndpoints(): ContractEndpoint[] {
  return Object.entries(facultyContract as unknown as Record<string, ContractEndpoint>)
    .filter(
      ([, endpoint]) => typeof endpoint?.path === "string" && typeof endpoint?.method === "string",
    )
    .map(([, endpoint]) => ({ method: endpoint.method.toUpperCase(), path: endpoint.path }));
}

describe("faculty contract route parity", () => {
  it("registers a route for every declared contract endpoint", async () => {
    const app = await buildApp();
    const endpoints = contractEndpoints();
    expect(endpoints.length).toBeGreaterThan(30);

    const missing = endpoints
      .filter((endpoint) => !app.hasRoute({ method: endpoint.method as never, url: endpoint.path }))
      .map((endpoint) => `${endpoint.method} ${endpoint.path}`);

    expect(missing).toEqual([]);
    await app.close();
  });

  it("no longer declares or serves the client-forgeable export-audit endpoint", async () => {
    const app = await buildApp();
    const endpoints = contractEndpoints();

    expect(endpoints.some((endpoint) => endpoint.path.endsWith("/export-audit"))).toBe(false);
    expect(app.hasRoute({ method: "POST" as never, url: "/api/faculty/export-audit" })).toBe(false);
    await app.close();
  });

  it("keeps the delete/restore faculty surfaces registered under the canonical prefix", async () => {
    const app = await buildApp();

    for (const [method, url] of [
      ["DELETE", "/api/faculty/:id"],
      ["POST", "/api/faculty/:id/restore"],
      ["POST", "/api/faculty/bulk-delete"],
      ["POST", "/api/faculty/bulk-restore"],
      ["DELETE", "/api/faculty/:facultyId/assignments/:id"],
    ] as const) {
      expect(app.hasRoute({ method: method as never, url })).toBe(true);
    }
    await app.close();
  });
});
