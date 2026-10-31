import { createHash } from "node:crypto";
import { constants } from "node:zlib";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import compress from "@fastify/compress";
import { isOriginAllowedForAppDomain, isTrustedWorkspaceOrigin } from "@mms/shared";
import type { ServerConfig } from "../config/serverConfig.js";
import { getRedisClient, getRedisSubscriberClient } from "../lib/redis.js";
import { startCacheInvalidationSubscriber } from "../lib/cache/index.js";
import { configureRedisPubSub } from "../lib/livePush.js";

import { getRequestTenant, resolveSubdomainFromRequest } from "../lib/tenantContext.js";

/**
 * Determines whether an API endpoint serves low-churn tenant metadata (lookups,
 * field registries, branding configurations, setup preferences) suitable for
 * conditional caching with `private, no-cache`, vs dynamic business state requiring
 * `private, no-cache, no-store, must-revalidate`.
 */
export function isTenantCacheableMetadataPath(url: string): boolean {
  const path = (url.split("?")[0] ?? "").toLowerCase();
  return (
    path.includes("/setup") ||
    path.includes("/setup-config") ||
    path.includes("/lookups") ||
    path.includes("/fields") ||
    path.includes("/field-config") ||
    path.includes("/branding") ||
    path.includes("/preferences") ||
    path.includes("/column-preferences") ||
    path.includes("/settings") ||
    path.includes("/registry") ||
    path.includes("/public-branding") ||
    path.includes("/schema") ||
    path.includes("/metadata") ||
    path.includes("/test-cacheable")
  );
}

export async function registerHttpPlugins(
  app: FastifyInstance,
  config: ServerConfig,
): Promise<void> {
  // Ensure Node.js HTTP server socket timeouts and TCP keep-alive settings are applied
  app.addHook("onReady", async () => {
    if (app.server) {
      if ("keepAliveTimeout" in app.server) {
        app.server.keepAliveTimeout = config.keepAliveTimeoutMs ?? 30_000;
      }
      if ("headersTimeout" in app.server) {
        app.server.headersTimeout = config.headersTimeoutMs ?? 35_000;
      }
      if ("requestTimeout" in app.server && config.requestTimeoutMs) {
        app.server.requestTimeout = config.requestTimeoutMs;
      }
      if (typeof app.server.on === "function") {
        app.server.on("connection", (socket) => {
          if (typeof socket?.setKeepAlive === "function") {
            socket.setKeepAlive(true, config.tcpKeepAliveInitialDelayMs ?? 10_000);
          }
          if (typeof socket?.setNoDelay === "function") {
            socket.setNoDelay(true);
          }
        });
      }
    }
  });

  // Prevent upstream double-compression when Apache edge proxy handles compression
  app.addHook("onRequest", async (request) => {
    if (request.headers["x-edge-compression"] || request.headers["x-no-compression"]) {
      request.headers["x-no-compression"] = "1";
    }
  });

  // RFC 7232 ETag & 304 Not Modified conditional caching with tenant salt and Vary isolation
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return payload;
    }
    if (reply.statusCode < 200 || reply.statusCode >= 300 || reply.statusCode === 204) {
      return payload;
    }
    if (payload == null || (typeof payload !== "string" && !Buffer.isBuffer(payload))) {
      return payload;
    }
    if (reply.hasHeader("etag")) {
      return payload;
    }

    const tenantHeader = request.headers["x-tenant-id"];
    const tenantId =
      getRequestTenant() ||
      (typeof tenantHeader === "string" ? tenantHeader.trim().toLowerCase() : null) ||
      resolveSubdomainFromRequest(request.headers.host, request.headers["x-forwarded-host"]);

    const schemaRevisionHeader = request.headers["x-schema-revision"];
    const schemaRevision =
      typeof schemaRevisionHeader === "string" ? schemaRevisionHeader.trim() : null;

    // Multi-tenant Vary isolation header to prevent intermediate proxy cache poisoning
    if (request.url.startsWith("/api")) {
      reply.header("Vary", "Accept-Encoding, X-Tenant-Id, Authorization");
    }

    // Skip synchronous SHA-1 hash computation for payloads > 4MB to avoid event loop blocking
    const byteLength = typeof payload === "string" ? Buffer.byteLength(payload) : payload.length;
    if (byteLength > 4 * 1024 * 1024) {
      return payload;
    }

    const hasher = createHash("sha1");
    if (tenantId) {
      hasher.update(`${tenantId}:`);
    }
    if (schemaRevision) {
      hasher.update(`${schemaRevision}:`);
    }
    hasher.update(payload);
    const digest = hasher.digest("hex").slice(0, 27);
    const etag = tenantId
      ? schemaRevision
        ? `W/"${tenantId}-r${schemaRevision}-${digest}"`
        : `W/"${tenantId}-${digest}"`
      : schemaRevision
        ? `W/"r${schemaRevision}-${digest}"`
        : `W/"${digest}"`;
    reply.header("etag", etag);

    if (!reply.hasHeader("cache-control")) {
      if (isTenantCacheableMetadataPath(request.url)) {
        reply.header("cache-control", "private, no-cache");
      } else {
        reply.header("cache-control", "private, no-cache, no-store, must-revalidate");
      }
    }

    const ifNoneMatch = request.headers["if-none-match"];
    if (ifNoneMatch) {
      if (ifNoneMatch === etag || ifNoneMatch === "*" || ifNoneMatch.includes(etag)) {
        reply.code(304);
        return "";
      }
    }

    return payload;
  });

  await app.register(compress, {
    global: true,
    threshold: 1024,
    brotliOptions: {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 4,
      },
    },
    zlibOptions: {
      level: 6,
    },
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: config.isProd
      ? (origin, cb) => {
          if (!origin) {
            cb(null, true);
            return;
          }
          const appDomain = process.env.MMS_APP_DOMAIN?.trim();
          if (appDomain && isOriginAllowedForAppDomain(origin, appDomain)) {
            cb(null, true);
            return;
          }
          if (!appDomain && isTrustedWorkspaceOrigin(origin)) {
            cb(null, true);
            return;
          }
          if (origin === config.allowedOrigin) {
            cb(null, true);
            return;
          }
          cb(null, false);
        }
      : true,
    credentials: true,
  });
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(websocket);

  const redisPub = getRedisClient();
  const redisSub = getRedisSubscriberClient();
  if (redisPub) {
    configureRedisPubSub(redisPub, redisSub || undefined);
    // Cross-instance L1 invalidation (RBAC matrix, settings, module availability)
    // only works while a subscriber is registered. Starting it from the test-only
    // cacheManager facade left every PM2 instance stale for up to the cache TTL.
    if (!startCacheInvalidationSubscriber()) {
      app.log.error(
        "Redis pub/sub unavailable — cross-instance cache invalidation is disabled until it recovers",
      );
    }
  }
}
