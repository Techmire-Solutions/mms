import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
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

const mockChangePassword = vi.hoisted(() =>
  vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
);

vi.mock("../services/auth/userService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth/userService.js")>();
  return {
    ...actual,
    changeTenantUserPassword: mockChangePassword,
  };
});

vi.mock("../services/auth/authArtifactService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth/authArtifactService.js")>();
  return {
    ...actual,
    deleteRefreshTokensForUser: vi.fn().mockResolvedValue(undefined),
  };
});

import { buildApp } from "../app.js";
import { signTenantToken } from "./helpers/tokens.js";
import { clearInMemoryRedisFallback } from "../lib/redis.js";

/**
 * F38: a self-service password change is what a user does when they suspect
 * compromise. Before this fix it cleared only the caller's cookies, leaving a
 * second device (and its 7-day refresh artifact) signed in.
 */
describe("self-service password change revocation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    clearInMemoryRedisFallback();
    await app.close();
  });

  it("rejects a second session token after a successful password change", async () => {
    const firstSession = signTenantToken(app, {
      id: "u-password",
      workspaceSubdomain: "demo",
      jti: "jti-password-first",
    });
    const secondSession = signTenantToken(app, {
      id: "u-password",
      workspaceSubdomain: "demo",
      jti: "jti-password-second",
    });

    const changed = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${firstSession}`,
        "content-type": "application/json",
      },
      payload: {
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
      },
    });

    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({ success: true, requiresSignIn: true });
    expect(mockChangePassword).toHaveBeenCalledWith("u-password", "OldPassword1!", "NewPassword1!");

    const secondSessionResult = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${secondSession}`,
      },
    });

    expect(secondSessionResult.statusCode).toBe(401);
    expect(secondSessionResult.json()).toMatchObject({ type: "auth_required" });
  });
});
