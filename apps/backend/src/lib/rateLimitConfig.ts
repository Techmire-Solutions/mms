import type { FastifyRequest } from "fastify";
import { getRequestTenant } from "./tenantContext.js";

interface RateLimitErrorContext {
  statusCode: number;
}

const RATE_LIMIT_MESSAGE = "Too many requests. Please try again later.";

function buildRateLimitError(message: string, context: RateLimitErrorContext) {
  return {
    statusCode: context.statusCode,
    code: "rate_limit_exceeded",
    type: "rate_limit_exceeded",
    message,
  };
}

/**
 * Derives the rate-limit bucket key.
 *
 * The tenant comes ONLY from the request's AsyncLocalStorage context, which is
 * bound from the verified host by `registerRequestHooks` (registered before the
 * security plugins for exactly this reason). When no tenant is bound the bucket
 * is the client IP alone.
 *
 * This used to read `X-Tenant-Id` (and fall back to the `Host` subdomain). Both
 * are client-controlled — a caller could mint a fresh bucket per request just by
 * changing the header, so the only throttle on ~500 non-auth routes was
 * unbounded by rotation. A trusted tenant still isolates tenants from each other
 * (one tenant cannot starve another behind a shared NAT), but it can no longer be
 * fabricated.
 */
export function generateCompositeRateLimitKey(request: FastifyRequest): string {
  const clientIp = request.ip || request.socket?.remoteAddress || "127.0.0.1";
  const tenant = getRequestTenant()?.trim().toLowerCase();
  return tenant ? `${tenant}:${clientIp}` : clientIp;
}

/**
 * Standard 429 payload. Exported so {@link createStrictRateLimitGuard} can
 * produce a byte-identical response to the plugin's own errorResponseBuilder.
 */
export function buildRateLimitExceededBody(): {
  statusCode: number;
  code: string;
  type: string;
  message: string;
} {
  return buildRateLimitError(RATE_LIMIT_MESSAGE, { statusCode: 429 });
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isTest(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

/**
 * Baseline limit applied to every route.
 *
 * Previously the limiter was registered with `global: false` and only ~9 of 110
 * route files opted in, so list/report/CRUD endpoints were unthrottled — one
 * authenticated tenant could hammer expensive report queries freely. A global
 * default now covers those, while the tighter per-route limits (auth, messaging,
 * exports) still override it.
 *
 * The test environment keeps a deliberately high ceiling so integration suites
 * that burst requests are not throttled; `RATE_LIMIT_GLOBAL_MAX` overrides in
 * any environment.
 */
export const GLOBAL_RATE_LIMIT_MAX =
  Number.parseInt(process.env.RATE_LIMIT_GLOBAL_MAX ?? "", 10) ||
  (isTest() ? 100_000 : isProduction() ? 300 : 10_000);

export const GLOBAL_RATE_LIMIT = {
  max: GLOBAL_RATE_LIMIT_MAX,
  timeWindow: "1 minute" as const,
  keyGenerator: (request: FastifyRequest) => generateCompositeRateLimitKey(request),
  errorResponseBuilder: (_request: unknown, context: RateLimitErrorContext) =>
    buildRateLimitError(RATE_LIMIT_MESSAGE, context),
};

export const AUTH_RATE_LIMIT = {
  max: isProduction() ? 10 : 1000,
  timeWindow: "1 minute" as const,
  keyGenerator: (request: FastifyRequest) => generateCompositeRateLimitKey(request),
  errorResponseBuilder: (_request: unknown, context: RateLimitErrorContext) =>
    buildRateLimitError(RATE_LIMIT_MESSAGE, context),
};

/** Public registration submissions: per IP + workspace (anti-spam, no auth on this path). */
export const PUBLIC_REGISTRATION_RATE_LIMIT = {
  max: isProduction() ? 5 : 1000,
  timeWindow: "10 minutes" as const,
  keyGenerator: (request: FastifyRequest) => generateCompositeRateLimitKey(request),
  errorResponseBuilder: (_request: unknown, context: RateLimitErrorContext) =>
    buildRateLimitError(RATE_LIMIT_MESSAGE, context),
};

/** Rate limit for messaging write paths (dispatch log POSTs and export enqueue). */
export const MESSAGING_LOG_RATE_LIMIT = {
  max: isProduction() ? 30 : 1000,
  timeWindow: "1 minute" as const,
  keyGenerator: (request: FastifyRequest) => generateCompositeRateLimitKey(request),
  errorResponseBuilder: (_request: unknown, context: RateLimitErrorContext) =>
    buildRateLimitError("Too many message log requests. Please try again later.", context),
};
