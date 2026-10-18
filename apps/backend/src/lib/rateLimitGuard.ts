import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RateLimitOptions } from "@fastify/rate-limit";
import { buildRateLimitExceededBody } from "./rateLimitConfig.js";

/**
 * A stricter-than-global rate limit that still works when a global limiter is
 * registered.
 *
 * Why not `fastify.rateLimit(...)` as a preHandler?
 * ------------------------------------------------
 * The plugin guards its preHandler-style handler with a per-instance marker:
 *
 *   if (req[rateLimitRan]) return
 *   req[rateLimitRan] = true
 *
 * With `global: true` the global `onRequest` hook has already set that marker,
 * so every preHandler-style limiter silently becomes a no-op — the stricter
 * auth limit would stop being enforced. (`@fastify/rate-limit`'s supported
 * alternative, `routeOptions.config.rateLimit`, cannot be used here because
 * `@ts-rest/fastify` hardcodes `config` when it builds each route.)
 *
 * `fastify.createRateLimit()` returns the raw decision function WITHOUT that
 * marker check, so this helper uses it and applies the standard response
 * ourselves — keeping the strict limit effective alongside the global one.
 */
export function createStrictRateLimitGuard(
  fastify: FastifyInstance,
  options: RateLimitOptions,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const check = fastify.createRateLimit({
    allowList: () => false,
    ...options,
  } as Parameters<FastifyInstance["createRateLimit"]>[0]);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await check(request);
    if (result.isAllowed || !result.isExceeded) {
      return;
    }

    const retryAfterSeconds = result.ttlInSeconds ?? 0;
    reply.header("x-ratelimit-limit", result.max);
    reply.header("x-ratelimit-remaining", 0);
    reply.header("x-ratelimit-reset", retryAfterSeconds);
    reply.header("retry-after", retryAfterSeconds);

    const exhausted = buildRateLimitExceededBody();
    await reply.status(exhausted.statusCode).send({
      type: exhausted.type,
      code: exhausted.code,
      message: exhausted.message,
    });
  };
}
