import type { FastifyInstance } from "fastify";
import { checkIsRedisConnected } from "../lib/redis.js";
import { getPoolMetrics } from "../db/database.js";
import {
  HTTP_DURATION_BUCKETS,
  HTTP_REQUESTS_TOTAL,
  metrics,
  registerDefaultMetrics,
} from "../lib/metrics.js";

/**
 * Operational metrics instrumentation.
 *
 * Registers the standard metric families and an `onResponse` hook that records
 * request count + latency. Gauges (DB pool, Redis, process) are collected at
 * scrape time so they are always current and need no background timers.
 *
 * CARDINALITY: requests are labelled with the ROUTE PATTERN
 * (`request.routeOptions.url`, e.g. `/api/users/:id`) and the status CODE CLASS,
 * never the raw URL or the exact status text. Labelling on the raw path would
 * create a distinct time series per id; this keeps the series count bounded by
 * the number of routes.
 */
export function registerMetricsPlugin(app: FastifyInstance): void {
  registerDefaultMetrics();

  const startedAt = Date.now();

  // --- DB pool saturation (the signal that matters most for this app) -------
  metrics.gauge(
    "mms_db_pool_connections",
    "Postgres pool connections by state (total/idle/waiting).",
    () => {
      const pool = getPoolMetrics();
      if (!pool) return [];
      return [
        { labels: { state: "total", pool: "primary" }, value: pool.totalCount },
        { labels: { state: "idle", pool: "primary" }, value: pool.idleCount },
        { labels: { state: "waiting", pool: "primary" }, value: pool.waitingCount },
        ...(pool.replica
          ? [
              { labels: { state: "total", pool: "replica" }, value: pool.replica.totalCount },
              { labels: { state: "idle", pool: "replica" }, value: pool.replica.idleCount },
              { labels: { state: "waiting", pool: "replica" }, value: pool.replica.waitingCount },
            ]
          : []),
      ];
    },
  );

  metrics.gauge(
    "mms_redis_connected",
    "Whether the Redis client is currently connected (1/0).",
    () => [{ value: checkIsRedisConnected() ? 1 : 0 }],
  );

  // --- Process health ------------------------------------------------------
  metrics.gauge("mms_process_uptime_seconds", "Process uptime in seconds.", () => [
    { value: Math.round((Date.now() - startedAt) / 1000) },
  ]);

  metrics.gauge("mms_process_resident_memory_bytes", "Resident set size in bytes.", () => [
    { value: process.memoryUsage().rss },
  ]);

  metrics.gauge("mms_nodejs_heap_used_bytes", "V8 heap used in bytes.", () => [
    { value: process.memoryUsage().heapUsed },
  ]);

  metrics.gauge("mms_nodejs_heap_total_bytes", "V8 heap total in bytes.", () => [
    { value: process.memoryUsage().heapTotal },
  ]);

  /**
   * Event-loop lag: the delay between a scheduled timer and its execution. This
   * is the clearest early warning that synchronous work (e.g. a large JSON
   * serialisation or a PDF render) is blocking the request loop.
   */
  let lastSample = process.hrtime.bigint();
  let sampledLagMs = 0;
  const lagTimer = setInterval(() => {
    const now = process.hrtime.bigint();
    const elapsedMs = Number(now - lastSample) / 1e6;
    sampledLagMs = Math.max(0, elapsedMs - LAG_INTERVAL_MS);
    lastSample = now;
  }, LAG_INTERVAL_MS);
  // Never hold the process open for a metric.
  lagTimer.unref?.();

  metrics.gauge(
    "mms_nodejs_event_loop_lag_seconds",
    "Event loop lag in seconds, sampled every 5s.",
    () => [{ value: Number((sampledLagMs / 1000).toFixed(6)) }],
  );

  app.addHook("onResponse", (request, reply, done) => {
    try {
      const route = request.routeOptions?.url ?? "unmatched";
      const statusClass = `${Math.floor(reply.statusCode / 100)}xx`;
      const labels = { route, method: request.method, status: statusClass };

      metrics.increment(HTTP_REQUESTS_TOTAL, labels);
      metrics.observe("mms_http_request_duration_seconds", reply.elapsedTime / 1000, {
        route,
        method: request.method,
      });
    } catch {
      // Metrics must never break a response.
    }
    done();
  });

  app.log.info(
    { durationBuckets: HTTP_DURATION_BUCKETS.length },
    "Operational metrics instrumentation registered",
  );
}

const LAG_INTERVAL_MS = 5_000;

/**
 * Whether the `/metrics` endpoint should be served.
 *
 * Off by default: the payload exposes internal topology (pool sizes, route
 * inventory, memory) and should not be internet-reachable. Enable deliberately
 * per environment and scrape it over a private network.
 */
export function isMetricsEndpointEnabled(): boolean {
  return process.env.METRICS_ENABLED === "true";
}

/**
 * Optional shared-secret guard for environments where the metrics port is not
 * fully private. Fails closed when a token is configured but not supplied.
 */
export function isMetricsRequestAuthorized(authorizationHeader?: string): boolean {
  const expected = process.env.METRICS_TOKEN;
  if (!expected) return true;
  if (!authorizationHeader) return false;
  const [scheme, token] = authorizationHeader.split(" ");
  return scheme?.toLowerCase() === "bearer" && token === expected;
}
