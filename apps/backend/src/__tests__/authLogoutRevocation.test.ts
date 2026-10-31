import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

const mockRevokeToken = vi.hoisted(() =>
  vi.fn<(jti: string, ttlSeconds: number) => Promise<void>>().mockResolvedValue(undefined),
);

vi.mock("../services/authSessionService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/authSessionService.js")>();
  return {
    ...actual,
    revokeToken: mockRevokeToken,
    revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
  };
});

import { buildApp } from "../app.js";
import { ACCESS_COOKIE } from "../services/auth/authCookieService.js";

/**
 * F37: `revokeToken` used to hard-code a 15-minute marker TTL, so a default
 * 60-minute access token was accepted again 15 minutes after sign-out. The
 * logout route must size the marker from the token's own remaining lifetime.
 */
describe("tenant logout revocation lifetime", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockRevokeToken.mockClear();
  });

  function signAccessToken(expiresIn: string): {
    token: string;
    jti: string;
    exp: number;
  } {
    const token = app.jwt.sign(
      {
        id: "u-logout",
        email: "logout@test.com",
        name: "Logout",
        role: "admin",
        workspaceSubdomain: "demo",
        twoFactorVerified: true,
        tokenType: "access",
        jti: "jti-logout-1",
      },
      { expiresIn },
    );
    const decoded = app.jwt.decode(token) as { jti: string; exp: number };
    return { token, jti: decoded.jti, exp: decoded.exp };
  }

  async function logout(token: string) {
    return app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        host: "demo.localhost",
        origin: "http://demo.localhost",
        cookie: `${ACCESS_COOKIE}=${token}`,
      },
    });
  }

  it("keeps the revocation marker at least as long as a 60-minute token", async () => {
    const { token, jti, exp } = signAccessToken("60m");

    const res = await logout(token);

    expect(res.statusCode).toBe(200);
    expect(mockRevokeToken).toHaveBeenCalledTimes(1);
    const [revokedJti, ttlSeconds] = mockRevokeToken.mock.calls[0]!;
    expect(revokedJti).toBe(jti);
    // Marker outlives the token: old fixed TTL was 900s, token life is 3600s.
    expect(ttlSeconds).toBeGreaterThan(15 * 60);
    expect(ttlSeconds).toBeGreaterThanOrEqual(exp - Math.floor(Date.now() / 1000) - 1);
  });

  it("floors very short-lived tokens at 60 seconds", async () => {
    const { token } = signAccessToken("20s");

    const res = await logout(token);

    expect(res.statusCode).toBe(200);
    expect(mockRevokeToken.mock.calls[0]?.[1]).toBe(60);
  });
});
