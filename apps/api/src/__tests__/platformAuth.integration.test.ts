import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  listPlatformUsers: vi.fn().mockResolvedValue([{ id: "p-super" }]),
  countPlatformUserRows: vi.fn().mockResolvedValue(1),
  findPlatformUserRowByEmail: vi.fn().mockResolvedValue(null),
  findPlatformUserRowById: vi.fn().mockResolvedValue(null),
}));

vi.mock("../db/repositories/platformSettingsRepository.js", () => ({
  getPlatformSettingsRow: vi.fn().mockResolvedValue({ id: "global", smtpHost: "smtp.example.com" }),
}));

describe("platformAuth REST API integration routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns setup status from GET /api/platform/auth/setup/status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/auth/setup/status",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.needsSetup).toBe("boolean");
    expect(typeof body.smtpConfigured).toBe("boolean");
  });

  it("returns false user state for unauthenticated GET /api/platform/auth/me", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/auth/me",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toBeNull();
    expect(body.isAuthenticated).toBe(false);
  });

  it("rejects invalid credentials on POST /api/platform/auth/login with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/login",
      payload: {
        email: "non-existent-super-admin@apex.test",
        password: "WrongPassword123!",
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.type).toBe("invalid_credentials");
  });
});
