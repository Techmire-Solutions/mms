import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const mocks = vi.hoisted(() => {
  const superUser = {
    id: "p-super",
    email: "admin@platform.com",
    name: "Super Admin",
    passwordHash: "hash",
    role: "super_user" as const,
    permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    disabledAt: null as string | null,
  };
  return {
    superUser,
    findUserByEmail: vi.fn().mockResolvedValue(superUser),
    findUserById: vi.fn().mockResolvedValue(superUser),
    verifyPassword: vi.fn().mockResolvedValue(true),
    isTwoFactorRequired: vi.fn().mockReturnValue(true),
    createChallenge: vi.fn().mockResolvedValue("challenge-abc"),
    verifyChallenge: vi.fn().mockResolvedValue(superUser),
    resendChallenge: vi.fn().mockResolvedValue({ ok: true }),
  };
});

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  findPlatformUserRowByEmail: mocks.findUserByEmail,
  findPlatformUserRowById: mocks.findUserById,
  listPlatformUsers: vi.fn().mockResolvedValue([mocks.superUser]),
  countPlatformUserRows: vi.fn().mockResolvedValue(1),
}));

vi.mock("../services/auth/passwordService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth/passwordService.js")>();
  return {
    ...actual,
    verifyPassword: mocks.verifyPassword,
    hashPassword: vi.fn().mockResolvedValue("hash"),
  };
});

vi.mock("../services/platform/platformTwoFactorService.js", () => ({
  isPlatformTwoFactorRequired: mocks.isTwoFactorRequired,
  createPlatformTwoFactorChallenge: mocks.createChallenge,
  verifyPlatformTwoFactorChallenge: mocks.verifyChallenge,
  resendPlatformTwoFactorChallenge: mocks.resendChallenge,
}));

describe("platform 2FA login flow (PLATFORM_REQUIRE_2FA)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a challenge (requires2FA) instead of a session on login when 2FA is enabled", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/login",
      payload: { email: "admin@platform.com", password: "Password123!" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.requires2FA).toBe(true);
    expect(body.challengeId).toBe("challenge-abc");
    expect(body.user.email).toBe("admin@platform.com");
  });

  it("establishes a session after a valid 2FA code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/2fa/verify",
      payload: { challengeId: "challenge-abc", code: "123456" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.id).toBe("p-super");
    // Session cookie should be set on the response.
    const setCookie = res.headers["set-cookie"];
    expect(Array.isArray(setCookie) || typeof setCookie === "string").toBe(true);
    expect(String(setCookie).toLowerCase()).toContain("mms_platform_access");
  });

  it("resends a fresh 2FA code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/2fa/resend",
      payload: { challengeId: "challenge-abc" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mocks.resendChallenge).toHaveBeenCalledWith("challenge-abc");
  });

  it("issues a session directly when 2FA is not required", async () => {
    mocks.isTwoFactorRequired.mockReturnValueOnce(false);
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/login",
      payload: { email: "admin@platform.com", password: "Password123!" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.requires2FA).toBeFalsy();
    expect(body.user.id).toBe("p-super");
    expect(String(res.headers["set-cookie"]).toLowerCase()).toContain("mms_platform_access");
  });
});
