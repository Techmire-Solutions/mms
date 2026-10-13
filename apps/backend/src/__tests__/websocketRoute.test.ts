import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import fastifyWebsocket from "@fastify/websocket";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import websocketRoutes from "../routes/common/websocket.js";
import { ACCESS_COOKIE } from "../services/auth/authCookieService.js";
import { isTokenRevoked } from "../services/authSessionService.js";
import { getWorkspaceBySubdomain } from "../services/workspaceService.js";

vi.mock("../services/authSessionService.js", () => ({
  isTenantBlocked: vi.fn().mockResolvedValue(false),
  isTokenRevoked: vi.fn().mockResolvedValue(false),
  isUserSessionRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock("../services/workspaceService.js", () => ({
  getWorkspaceBySubdomain: vi.fn().mockImplementation(async (sub: string) => {
    if (sub === "demo") {
      return { id: "ws-demo", subdomain: "demo", enabled: true };
    }
    return null;
  }),
}));

const mockRegisteredConnections: Array<{ subdomain: string; userId: string }> = [];
vi.mock("../lib/livePush.js", () => ({
  registerConnection: vi
    .fn()
    .mockImplementation((subdomain: string, _socket: unknown, userId: string) => {
      mockRegisteredConnections.push({ subdomain, userId });
      return () => {};
    }),
}));

async function buildWsTestApp() {
  const app = fastify();
  await app.register(fastifyCookie);
  await app.register(fastifyJwt, { secret: "test-secret-key-1234567890" });
  await app.register(fastifyWebsocket);
  await app.register(websocketRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

interface ConnectResult {
  opened: boolean;
  code?: number;
  reason?: string;
}

/** Resolves on the first of open / close / error / timeout. */
function connect(url: string, headers: Record<string, string>): Promise<ConnectResult> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    let settled = false;
    const done = (r: ConnectResult) => {
      if (settled) return;
      settled = true;
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
      resolve(r);
    };
    ws.on("open", () => done({ opened: true }));
    ws.on("close", (code, reason) => done({ opened: false, code, reason: reason.toString() }));
    ws.on("error", () => done({ opened: false }));
    setTimeout(() => done({ opened: false }), 3000);
  });
}

/** Resolves on close (ignoring open) so async rejections are captured. */
function connectAndWaitForClose(
  url: string,
  headers: Record<string, string>,
): Promise<ConnectResult> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    let settled = false;
    const done = (r: ConnectResult) => {
      if (settled) return;
      settled = true;
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
      resolve(r);
    };
    ws.on("close", (code, reason) => done({ opened: false, code, reason: reason.toString() }));
    ws.on("error", () => done({ opened: false }));
    setTimeout(() => done({ opened: false }), 3000);
  });
}

async function waitForConnections(count: number, timeout = 2000): Promise<void> {
  const start = Date.now();
  while (mockRegisteredConnections.length < count) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timed out waiting for ${count} registered connection(s)`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("WebSocket Route (/api/ws)", () => {
  let app: FastifyInstance;
  let url: string;

  beforeEach(async () => {
    mockRegisteredConnections.length = 0;
    vi.clearAllMocks();
    app = await buildWsTestApp();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address() as AddressInfo;
    url = `ws://127.0.0.1:${addr.port}/api/ws`;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  function signToken(overrides: Record<string, unknown> = {}) {
    return app.jwt.sign({
      id: "u-1",
      tokenType: "access",
      workspaceSubdomain: "demo",
      twoFactorVerified: true,
      ...overrides,
    });
  }

  it("rejects cross-site untrusted origin with 4003 (CSWSH defense)", async () => {
    const token = signToken();
    const res = await connectAndWaitForClose(url, {
      host: "demo.localhost",
      origin: "https://attacker-domain.evil.com",
      cookie: `${ACCESS_COOKIE}=${token}`,
    });
    expect(res.code).toBe(4003);
  });

  it("rejects missing subdomain context with 4000", async () => {
    const token = signToken();
    const res = await connectAndWaitForClose(url, {
      host: "localhost", // apex -> no tenant subdomain
      cookie: `${ACCESS_COOKIE}=${token}`,
    });
    expect(res.code).toBe(4000);
  });

  it("rejects a missing token with 4001", async () => {
    const res = await connectAndWaitForClose(url, {
      host: "demo.localhost",
      origin: "http://demo.localhost:5173",
    });
    expect(res.code).toBe(4001);
  });

  it("rejects an invalid token with 4001", async () => {
    const res = await connectAndWaitForClose(url, {
      host: "demo.localhost",
      origin: "http://demo.localhost:5173",
      cookie: `${ACCESS_COOKIE}=not-a-valid-token`,
    });
    expect(res.code).toBe(4001);
  });

  it("rejects a subdomain mismatch with 4003", async () => {
    const token = signToken({ workspaceSubdomain: "other" });
    const res = await connectAndWaitForClose(url, {
      host: "demo.localhost",
      origin: "http://demo.localhost:5173",
      cookie: `${ACCESS_COOKIE}=${token}`,
    });
    expect(res.code).toBe(4003);
  });

  it("rejects a revoked session with 4001", async () => {
    vi.mocked(isTokenRevoked).mockResolvedValueOnce(true);
    const token = signToken({ jti: "jti-1" });
    const res = await connectAndWaitForClose(url, {
      host: "demo.localhost",
      origin: "http://demo.localhost:5173",
      cookie: `${ACCESS_COOKIE}=${token}`,
    });
    expect(res.code).toBe(4001);
  });

  it("rejects a session that has not passed 2FA with 4001", async () => {
    const token = signToken({ twoFactorVerified: false });
    const res = await connectAndWaitForClose(url, {
      host: "demo.localhost",
      origin: "http://demo.localhost:5173",
      cookie: `${ACCESS_COOKIE}=${token}`,
    });
    expect(res.code).toBe(4001);
  });

  it("rejects a disabled workspace with 4003", async () => {
    vi.mocked(getWorkspaceBySubdomain).mockResolvedValueOnce({
      id: "ws-demo",
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      createdAt: "2026-01-01T00:00:00.000Z",
      enabled: false,
    });
    const token = signToken();
    const res = await connectAndWaitForClose(url, {
      host: "demo.localhost",
      origin: "http://demo.localhost:5173",
      cookie: `${ACCESS_COOKIE}=${token}`,
    });
    expect(res.code).toBe(4003);
  });

  it("accepts a valid connection with cookie auth and matching subdomain", async () => {
    const token = signToken();
    const res = await connect(url, {
      host: "demo.localhost",
      origin: "http://demo.localhost:5173",
      cookie: `${ACCESS_COOKIE}=${token}`,
    });
    expect(res.opened).toBe(true);
    await waitForConnections(1);
    expect(mockRegisteredConnections).toContainEqual({ subdomain: "demo", userId: "u-1" });
  });

  it("supports Bearer authorization header as fallback when cookie is absent", async () => {
    const token = signToken();
    const res = await connect(url, {
      host: "demo.localhost",
      origin: "http://demo.localhost:5173",
      authorization: `Bearer ${token}`,
    });
    expect(res.opened).toBe(true);
    await waitForConnections(1);
    expect(mockRegisteredConnections).toContainEqual({ subdomain: "demo", userId: "u-1" });
  });
});
