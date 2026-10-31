import type { FastifyInstance, FastifyRequest } from "fastify";
import { healthResponseSchema, readyResponseSchema, readyErrorResponseSchema } from "@mms/shared";
import { getPoolMetrics, pingDatabase } from "../../db/database.js";
import { checkIsRedisConnected } from "../../lib/redis.js";
import { isShuttingDown } from "../../lib/lifecycle.js";
import { getMultiTierCacheMetrics } from "../../lib/cache/index.js";
import { isMetricsRequestAuthorized } from "../../plugins/metricsPlugin.js";
import { isLoopbackRequest } from "../../lib/requestHost.js";

function safeGetPoolMetrics() {
  try {
    return typeof getPoolMetrics === "function" ? getPoolMetrics() : null;
  } catch {
    return null;
  }
}

/**
 * The detailed payload (pool/replica/cache/Redis topology) is only for trusted
 * scrapes: a loopback caller or a bearer token that matches a CONFIGURED
 * METRICS_TOKEN. `isMetricsRequestAuthorized` returns true when no token is
 * configured, so the explicit env check keeps non-loopback callers fail-closed.
 */
function isDetailedHealthAuthorized(request: FastifyRequest): boolean {
  // A forwarded client means the request reached us through a proxy: treat it
  // as external even when the proxy itself connected over loopback, otherwise
  // an Apache-fronted deployment without TRUST_PROXY would leak detail to the
  // internet. A direct local probe carries no X-Forwarded-For.
  if (isLoopbackRequest(request)) return true;
  if (!process.env.METRICS_TOKEN) return false;
  return isMetricsRequestAuthorized(request.headers.authorization);
}

interface ReadyProbeResult {
  statusCode: 200 | 503;
  payload: Record<string, unknown>;
}

const READY_PROBE_CACHE_DEFAULT_MS = 1_000;
let readyProbeCache: { at: number; result: ReadyProbeResult } | null = null;
let readyProbeInFlight: Promise<ReadyProbeResult> | null = null;

/** `READY_PROBE_CACHE_MS=0` disables the memoisation (tests/override). */
function readyProbeCacheMs(): number {
  const raw = Number(process.env.READY_PROBE_CACHE_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : READY_PROBE_CACHE_DEFAULT_MS;
}

/** Test helper: readiness is process-global so independent cases must reset it. */
export function resetReadyProbeCacheForTests(): void {
  readyProbeCache = null;
  readyProbeInFlight = null;
}

async function probeReadiness(): Promise<ReadyProbeResult> {
  const dbOk = await pingDatabase();
  const isRedisRequired = Boolean(
    process.env.REDIS_URL && process.env.NODE_ENV !== "test" && !process.env.VITEST,
  );
  const redisConnected = checkIsRedisConnected();
  const redisOk = !isRedisRequired || redisConnected;

  if (!dbOk || !redisOk) {
    return {
      statusCode: 503,
      payload: {
        type: "server_error",
        status: "not_ready",
        database: dbOk ? "connected" : "disconnected",
        redis: redisConnected ? "connected" : "disconnected",
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      status: "ready",
      database: "connected",
      redis: redisConnected ? "connected" : isRedisRequired ? "disconnected" : "optional",
      timestamp: new Date().toISOString(),
    },
  };
}

export default async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/health",
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async (request) => {
      const pool = safeGetPoolMetrics();
      const isDegraded = Boolean(
        pool && (pool.waitingCount > 5 || (pool.replica && pool.replica.waitingCount > 5)),
      );
      const status = isDegraded ? "DEGRADED" : "OK";
      const timestamp = new Date().toISOString();

      if (!isDetailedHealthAuthorized(request)) {
        // Public liveness probe: status only. Exposing pool sizes, replica state,
        // Redis connectivity, and cache counters unauthenticated hands an
        // attacker a live map of the deployment's internals.
        return { status, timestamp };
      }

      return {
        status,
        timestamp,
        pool,
        redis: {
          connected: checkIsRedisConnected(),
        },
        cache: getMultiTierCacheMetrics(),
      };
    },
  );

  fastify.get(
    "/ready",
    {
      schema: {
        response: {
          200: readyResponseSchema,
          503: readyErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      // Fail readiness FIRST during shutdown so the load balancer stops routing
      // here while in-flight requests are still being drained. Skipping the
      // database ping also keeps shutdown fast.
      if (isShuttingDown()) {
        return reply.status(503).send({
          type: "server_error",
          status: "not_ready",
          database: "draining",
          redis: "draining",
        });
      }

      const cacheMs = readyProbeCacheMs();
      let result: ReadyProbeResult;
      if (cacheMs > 0 && readyProbeCache && Date.now() - readyProbeCache.at < cacheMs) {
        result = readyProbeCache.result;
      } else {
        // Single-flight: concurrent probes share one database round-trip.
        readyProbeInFlight ??= probeReadiness().finally(() => {
          readyProbeInFlight = null;
        });
        result = await readyProbeInFlight;
        readyProbeCache = { at: Date.now(), result };
      }

      return reply.status(result.statusCode).send(result.payload);
    },
  );
}
