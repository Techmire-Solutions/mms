import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { ServerConfig } from "../config/serverConfig.js";
import { GLOBAL_RATE_LIMIT, generateCompositeRateLimitKey } from "../lib/rateLimitConfig.js";
import { checkIsRateLimitRedisConnected, getRateLimitRedisClient } from "../lib/redis.js";

/**
 * Per-request CSP nonce store. The nonce is generated in `onRequest` and
 * consumed in `onSend` to (a) allow the inline theme-flash script in the SPA
 * `index.html` and (b) stamp that same nonce onto the inline `<script>` tag.
 * This lets us drop `'unsafe-inline'` from `script-src`.
 */
const nonceStore = new WeakMap<FastifyRequest, string>();

/**
 * Hardened but SPA-compatible security headers.
 *
 * CSP notes:
 *  - `script-src` uses a per-request nonce (no `'unsafe-inline'`). The inline
 *    FOUC theme-flash script in the built `index.html` is stamped with the same
 *    nonce at serve time. `script-src-attr 'none'` blocks inline event handlers
 *    / `javascript:` URLs, and `script-src 'self'` blocks external scripts.
 *  - `worker-src 'self' blob:` supports PDF.js / client-side export workers.
 *  - `media-src 'self' data: blob:` supports audio playback for messaging voice notes.
 *  - Google Fonts allowed via `style-src`/`font-src`.
 *  - `frame-ancestors 'none'` and `object-src 'none'` block framing and plugins.
 */
/**
 * WebSocket origins the SPA may open.
 *
 * `connect-src` used to allow the bare schemes `ws:` and `wss:`, which permits a
 * WebSocket to ANY host — a ready-made exfiltration channel for injected script.
 * The client connects to `window.location.host` (same origin) unless
 * `VITE_API_URL` points at a separate API host, which deployments must declare
 * explicitly in `MMS_WS_ORIGINS`.
 */
function resolveWebSocketOrigins(): string[] {
  const configured = (process.env.MMS_WS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured;
}

function buildCspDirectives(isProd?: boolean, nonce?: string) {
  const scriptSources = ["'self'"];
  if (nonce) {
    scriptSources.push(`'nonce-${nonce}'`);
  }
  // Allow the theme bootstrap script even if older index.html is cached in user browsers
  scriptSources.push("'sha256-gk4Z7QZVEdEVHj4eZeOlFNEC2ZefOM9Ohn11Fh6G3Vo='");

  return {
    "default-src": ["'self'"],
    "script-src": scriptSources,
    "script-src-attr": ["'none'"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "media-src": ["'self'", "data:", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "connect-src": [
      "'self'",
      ...resolveWebSocketOrigins(),
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(isProd ? { "upgrade-insecure-requests": [] } : {}),
  };
}

function serializeCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => (values.length ? `${key} ${values.join(" ")}` : key))
    .join("; ");
}

/** Adds a `nonce` attribute to inline `<script>` tags (those without a `src`). */
function injectNonce(html: string, nonce: string): string {
  return html.replace(/<script(?![^>]*\bsrc=)([^>]*)>/gi, (match, attrs: string) => {
    if (/\snonce=/.test(attrs)) return match;
    return `<script${attrs} nonce="${nonce}">`;
  });
}

/**
 * Static asset / app-shell paths only. A non-API path that is not one of these
 * (notably `/ws`) still goes through the global limiter: previously every
 * non-`/api` URL was exempt, so the root WebSocket upgrade had no throttle.
 */
const STATIC_ASSET_PATH_PATTERNS = [
  /^\/$/,
  /^\/index\.html$/,
  /^\/assets\//,
  /^\/uploads\//,
  /^\/favicon\.(?:ico|svg|png)$/,
  /^\/platform-logo\.[a-z0-9]+$/,
  /^\/icon-[a-z0-9_-]+\.png$/,
  /^\/apple-touch-icon[^/]*\.png$/,
  /^\/site\.webmanifest$/,
  /^\/manifest\.json$/,
  /^\/sw\.js$/,
  /^\/robots\.txt$/,
];

/**
 * Determines if a request URL should bypass the global API rate limiter.
 * Only the operational probes (/health, /ready, /metrics) and static asset /
 * app-shell paths are exempt. `/ws` and SPA document routes are throttled.
 */
export function isRateLimitExempt(rawUrl: string): boolean {
  const path = (rawUrl.split("?")[0] ?? "").toLowerCase().replace(/\/+/g, "/");
  if (path === "/health" || path === "/ready" || path === "/metrics") {
    return true;
  }
  return STATIC_ASSET_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export async function registerSecurityPlugins(
  app: FastifyInstance,
  config?: ServerConfig,
): Promise<void> {
  const isProd = config?.isProd ?? process.env.NODE_ENV === "production";

  await app.register(helmet, {
    // CSP is set per-request in `onSend` so we can embed a per-request nonce.
    contentSecurityPolicy: false,
    // Enforce 1-year HSTS with preloading in production; disable in local dev
    hsts: isProd
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    // Prevents cross-origin window object tampering while allowing OAuth popups
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    // Restricts embedding to same-site (supports tenant subdomains on same root domain)
    crossOriginResourcePolicy: { policy: "same-site" },
    // Strict referrer policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });

  app.addHook("onRequest", async (request) => {
    nonceStore.set(request, randomBytes(16).toString("base64"));
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const nonce = nonceStore.get(request) ?? randomBytes(16).toString("base64");
    reply.header("content-security-policy", serializeCsp(buildCspDirectives(isProd, nonce)));

    const contentType = String(reply.getHeader("content-type") ?? "");
    if (!contentType.includes("text/html")) {
      return payload;
    }

    const encoding = String(reply.getHeader("content-encoding") ?? "");
    if (encoding && encoding !== "identity") {
      return payload;
    }

    if (typeof payload === "string") {
      return injectNonce(payload, nonce);
    }
    if (Buffer.isBuffer(payload)) {
      return injectNonce(payload.toString("utf8"), nonce);
    }
    if (payload && typeof (payload as { on?: unknown }).on === "function") {
      const chunks: Buffer[] = [];
      for await (const chunk of payload as AsyncIterable<Buffer | string>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return injectNonce(Buffer.concat(chunks).toString("utf8"), nonce);
    }
    return payload;
  });

  // Store selection.
  //
  // Default is the in-process store: at a single backend instance it is an
  // accurate ceiling, and it keeps auth routes protected when Redis is down
  // (the previous deliberate choice). Redis only makes the limit a *shared*
  // ceiling once more than one backend process serves traffic, so it is an
  // explicit opt-in — set RATE_LIMIT_REDIS_STORE=true when scaling out.
  const redisStoreRequested =
    process.env.RATE_LIMIT_REDIS_STORE === "true" || (isProd && Boolean(process.env.REDIS_URL));
  const redisClient = redisStoreRequested ? getRateLimitRedisClient() : null;

  if (redisStoreRequested && (!redisClient || !checkIsRateLimitRedisConnected())) {
    app.log.warn(
      "Redis rate-limit store requested but Redis is unavailable — falling back to the " +
        "in-process rate-limit store (limits are per-process until Redis recovers).",
    );
  }

  await app.register(rateLimit, {
    global: true,
    max: GLOBAL_RATE_LIMIT.max,
    timeWindow: GLOBAL_RATE_LIMIT.timeWindow,
    keyGenerator: (request) => generateCompositeRateLimitKey(request),
    errorResponseBuilder: GLOBAL_RATE_LIMIT.errorResponseBuilder,
    // Health/readiness probes, static assets, and SPA document routes must never be throttled.
    allowList: (request) => isRateLimitExempt(request.url),
    ...(redisClient && checkIsRateLimitRedisConnected() ? { redis: redisClient } : {}),
    addHeadersOnExceeding: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
  });
}
