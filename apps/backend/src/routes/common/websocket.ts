import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  isOriginAllowedForAppDomain,
  isTrustedWorkspaceOrigin,
  isWorkspaceEnabled,
} from "@mms/shared";
import { resolveSubdomainFromRequest } from "../../lib/tenantContext.js";
import { requestHostname } from "../../lib/requestHost.js";
import {
  isTenantBlocked,
  isTokenRevoked,
  isUserSessionRevoked,
} from "../../services/authSessionService.js";
import { getWorkspaceBySubdomain } from "../../services/workspaceService.js";
import { registerConnection, type MinimalWebSocket } from "../../lib/livePush.js";
import { ACCESS_COOKIE } from "../../services/auth/authCookieService.js";

interface DecodedToken {
  id: string;
  tokenType: string;
  workspaceSubdomain: string;
  twoFactorVerified?: boolean;
  jti?: string;
  iat?: number;
}

interface SocketWithReadyState extends MinimalWebSocket {
  readyState?: number;
}

function extractToken(app: FastifyInstance, req: FastifyRequest): string | undefined {
  if (req.headers.cookie) {
    try {
      const cookies = app.parseCookie(req.headers.cookie);
      if (cookies[ACCESS_COOKIE]) return cookies[ACCESS_COOKIE];
    } catch {
      // Ignore malformed cookie string
    }
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || undefined;
  }

  return undefined;
}

function isOriginAllowed(origin: string, requestHost: string, isProd: boolean): boolean {
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname.toLowerCase();

    if (
      isProd &&
      originUrl.protocol !== "https:" &&
      originHost !== "localhost" &&
      originHost !== "127.0.0.1"
    ) {
      return false;
    }

    if (originHost === requestHost) {
      return true;
    }

    const appDomain = process.env.MMS_APP_DOMAIN?.trim();
    if (appDomain && isOriginAllowedForAppDomain(origin, appDomain)) {
      return true;
    }

    if (
      !isProd &&
      (isTrustedWorkspaceOrigin(origin) || originHost === "localhost" || originHost === "127.0.0.1")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * WebSocket upgrade auth & CSWSH defense.
 * Validates Origin, JWT token, 2FA status, tenant matching, and revocation.
 */
export default async function websocketRoutes(app: FastifyInstance): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";

  app.get("/ws", { websocket: true }, (connection: unknown, req) => {
    const connObj = connection as { socket?: SocketWithReadyState };
    const socket = (connObj.socket || connection) as SocketWithReadyState;

    const requestHost = requestHostname(req);
    const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : undefined;

    // 1. Cross-Site WebSocket Hijacking (CSWSH) Origin Check
    if (origin && !isOriginAllowed(origin, requestHost, isProd)) {
      socket.close(4003, "Forbidden - Untrusted origin");
      return;
    }

    const subdomain = resolveSubdomainFromRequest(
      req.headers.host,
      req.headers["x-forwarded-host"],
    );

    if (!subdomain) {
      socket.close(4000, "Missing subdomain context");
      return;
    }

    const token = extractToken(app, req);
    if (!token) {
      socket.close(4001, "Unauthorized - Missing token");
      return;
    }

    let decoded: DecodedToken;
    try {
      decoded = app.jwt.verify(token) as DecodedToken;
    } catch {
      socket.close(4001, "Unauthorized - Invalid token");
      return;
    }

    if (!decoded || decoded.tokenType !== "access") {
      socket.close(4001, "Unauthorized - Invalid token type");
      return;
    }

    if (decoded.workspaceSubdomain !== subdomain) {
      socket.close(4003, "Forbidden - Subdomain mismatch");
      return;
    }

    // Perform asynchronous revocation & workspace validation. The socket is NOT
    // registered (registerConnection) until these checks pass, so it cannot
    // receive routed messages during the brief validation window — a client that
    // sends early is simply not connected yet.
    void (async () => {
      try {
        if (decoded.jti && (await isTokenRevoked(decoded.jti))) {
          socket.close(4001, "Unauthorized - Session revoked");
          return;
        }

        if (
          decoded.id &&
          decoded.iat &&
          (await isUserSessionRevoked(decoded.id, decoded.iat * 1000))
        ) {
          socket.close(4001, "Unauthorized - Session revoked");
          return;
        }

        if (decoded.twoFactorVerified === false) {
          socket.close(4001, "Forbidden - Two-factor authentication required");
          return;
        }

        if (await isTenantBlocked(subdomain)) {
          socket.close(4003, "Forbidden - Workspace disabled");
          return;
        }

        const workspace = await getWorkspaceBySubdomain(subdomain);
        if (!workspace || !isWorkspaceEnabled(workspace)) {
          socket.close(4003, "Forbidden - Workspace disabled");
          return;
        }

        // Check if the socket is still open before registering
        if (socket.readyState !== undefined && socket.readyState !== 1 /* WebSocket.OPEN */) {
          return;
        }

        // registerConnection returns null when the per-user (5) or per-tenant
        // (500) cap is already reached; close with 1013 (Try Again Later) so the
        // client backs off instead of assuming an auth failure.
        if (!registerConnection(subdomain, socket, decoded.id)) {
          socket.close(1013, "Too many live connections");
        }
      } catch {
        socket.close(4001, "Unauthorized - Invalid token");
      }
    })();
  });
}
