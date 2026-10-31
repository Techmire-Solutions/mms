import fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  HTTP_DURATION_BUCKETS,
  HTTP_REQUESTS_TOTAL,
  MetricsRegistry,
  metrics,
  registerDefaultMetrics,
} from "../lib/metrics.js";
import {
  isMetricsEndpointEnabled,
  isMetricsRequestAuthorized,
  registerMetricsPlugin,
} from "../plugins/metricsPlugin.js";
import metricsRoutes from "../routes/common/metrics.js";

describe("MetricsRegistry (Prometheus text exposition format)", () => {
  it("renders counters with sorted labels and a trailing newline", () => {
    const registry = new MetricsRegistry();
    registry.counter("mms_test_total", "help text");
    registry.increment("mms_test_total", { status: "2xx", method: "GET" }, 2);
    registry.increment("mms_test_total", { status: "2xx", method: "GET" }, 3);
    registry.increment("mms_test_total", { status: "5xx", method: "GET" });

    const { body, contentType } = registry.render();
    expect(contentType).toContain("text/plain");
    expect(body).toContain("# TYPE mms_test_total counter");
    // Labels are sorted alphabetically for stable output (method before status).
    expect(body).toContain('mms_test_total{method="GET",status="2xx"} 5');
    expect(body).toContain('mms_test_total{method="GET",status="5xx"} 1');
    expect(body.endsWith("\n")).toBe(true);
  });

  it("escapes label values that would otherwise break the format", () => {
    const registry = new MetricsRegistry();
    registry.counter("mms_esc_total", "help");
    registry.increment("mms_esc_total", { route: '/a"b\\c\nd' });

    const { body } = registry.render();
    expect(body).toContain('route="/a\\"b\\\\c\\nd"');
    // The value must stay on one line — a raw newline would corrupt the scrape.
    const sampleLines = body.split("\n").filter((l) => l.startsWith("mms_esc_total{"));
    expect(sampleLines).toHaveLength(1);
    expect(sampleLines[0]).toMatch(/^mms_esc_total\{route=".*"\} 1$/);
  });

  it("renders histograms with cumulative buckets, +Inf, _sum and _count", () => {
    const registry = new MetricsRegistry();
    registry.histogram("mms_lat_seconds", "help", [0.1, 1]);

    registry.observe("mms_lat_seconds", 0.05, { route: "/x" });
    registry.observe("mms_lat_seconds", 0.5, { route: "/x" });
    registry.observe("mms_lat_seconds", 5, { route: "/x" });

    const { body } = registry.render();
    expect(body).toContain('mms_lat_seconds_bucket{le="0.1",route="/x"} 1');
    // Cumulative: both observations <= 1s are counted in the 1s bucket.
    expect(body).toContain('mms_lat_seconds_bucket{le="1",route="/x"} 2');
    expect(body).toContain('mms_lat_seconds_bucket{le="+Inf",route="/x"} 3');
    expect(body).toContain('mms_lat_seconds_count{route="/x"} 3');
    expect(body).toContain('mms_lat_seconds_sum{route="/x"} 5.55');
  });

  it("does not let a failing gauge collector break the whole scrape", () => {
    const registry = new MetricsRegistry();
    registry.counter("mms_ok_total", "help");
    registry.increment("mms_ok_total", undefined, 1);
    registry.gauge("mms_broken", "help", () => {
      throw new Error("collector exploded");
    });

    const { body } = registry.render();
    expect(body).toContain("mms_ok_total 1");
    expect(body).toContain("# TYPE mms_broken gauge");
  });

  it("ignores observations for unregistered families instead of throwing", () => {
    const registry = new MetricsRegistry();
    expect(() => registry.increment("mms_missing_total")).not.toThrow();
    expect(() => registry.observe("mms_missing_seconds", 1)).not.toThrow();
  });
});

describe("metrics endpoint", () => {
  const apps: ReturnType<typeof fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    delete process.env.METRICS_ENABLED;
    delete process.env.METRICS_TOKEN;
    metrics.reset();
  });

  it("404s when metrics are not enabled, so the route is not advertised", async () => {
    const app = fastify({ logger: false });
    apps.push(app);
    await app.register(metricsRoutes);

    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(404);
  });

  it("serves Prometheus text when enabled", async () => {
    process.env.METRICS_ENABLED = "true";
    const app = fastify({ logger: false });
    apps.push(app);
    registerMetricsPlugin(app);
    await app.register(metricsRoutes);

    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("# TYPE mms_db_pool_connections gauge");
    expect(res.body).toContain("# TYPE mms_redis_connected gauge");
    expect(res.body).toContain("mms_process_uptime_seconds");
    expect(res.body).toContain("mms_nodejs_event_loop_lag_seconds");
  });

  it("requires a bearer token when METRICS_TOKEN is configured", async () => {
    process.env.METRICS_ENABLED = "true";
    process.env.METRICS_TOKEN = "s3cret";
    const app = fastify({ logger: false });
    apps.push(app);
    registerMetricsPlugin(app);
    await app.register(metricsRoutes);

    // Non-loopback scrapes need the token; loopback (below) is trusted.
    const external = { remoteAddress: "203.0.113.9" } as const;
    expect((await app.inject({ method: "GET", url: "/metrics", ...external })).statusCode).toBe(
      401,
    );
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/metrics",
          ...external,
          headers: { authorization: "Bearer wrong" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/metrics",
          ...external,
          headers: { authorization: "Bearer s3cret" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/metrics",
          remoteAddress: "127.0.0.1",
        })
      ).statusCode,
    ).toBe(200);
  });

  it("fails closed when a token is configured but no header is sent", () => {
    process.env.METRICS_TOKEN = "s3cret";
    expect(isMetricsRequestAuthorized(undefined)).toBe(false);
    expect(isMetricsRequestAuthorized("Bearer s3cret")).toBe(true);
    delete process.env.METRICS_TOKEN;
    expect(isMetricsRequestAuthorized(undefined)).toBe(true);
  });

  it("is disabled unless explicitly enabled", () => {
    expect(isMetricsEndpointEnabled()).toBe(false);
    process.env.METRICS_ENABLED = "true";
    expect(isMetricsEndpointEnabled()).toBe(true);
  });
});

describe("HTTP metrics instrumentation", () => {
  const apps: ReturnType<typeof fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    metrics.reset();
  });

  /**
   * The important property: labels come from the ROUTE PATTERN, not the raw URL.
   * Labelling on the raw path would create one time series per user id, which is
   * how a metrics endpoint takes down the scrape backend.
   */
  it("labels requests by route pattern so cardinality stays bounded", async () => {
    const app = fastify({ logger: false });
    apps.push(app);
    registerMetricsPlugin(app);
    app.get("/api/users/:id", async () => ({ ok: true }));

    for (const id of ["u-1", "u-2", "u-3", "u-4"]) {
      const res = await app.inject({ method: "GET", url: `/api/users/${id}` });
      expect(res.statusCode).toBe(200);
    }

    const { body } = metrics.render();
    // One series for the pattern, carrying all four requests.
    expect(body).toContain(
      `mms_http_requests_total{method="GET",route="/api/users/:id",status="2xx"} 4`,
    );
    // No series per id.
    expect(body).not.toContain("u-1");
    expect(body).not.toContain("u-2");
  });

  it("records latency into the configured buckets", async () => {
    const app = fastify({ logger: false });
    apps.push(app);
    registerMetricsPlugin(app);
    app.get("/api/thing", async () => ({ ok: true }));

    await app.inject({ method: "GET", url: "/api/thing" });

    const { body } = metrics.render();
    expect(body).toContain(
      'mms_http_request_duration_seconds_count{method="GET",route="/api/thing"} 1',
    );
    expect(body).toContain(
      'mms_http_request_duration_seconds_bucket{le="+Inf",method="GET",route="/api/thing"} 1',
    );
    expect(HTTP_DURATION_BUCKETS.length).toBeGreaterThan(0);
  });

  it("records the status class for failures", async () => {
    const app = fastify({ logger: false });
    apps.push(app);
    registerMetricsPlugin(app);
    app.get("/api/boom", async (_req, reply) => reply.status(503).send({}));

    await app.inject({ method: "GET", url: "/api/boom" });

    const { body } = metrics.render();
    expect(body).toContain(
      `mms_http_requests_total{method="GET",route="/api/boom",status="5xx"} 1`,
    );
  });

  it("registers the default families idempotently", () => {
    registerDefaultMetrics();
    registerDefaultMetrics();
    metrics.increment(HTTP_REQUESTS_TOTAL, { route: "/x" });
    expect(metrics.render().body).toContain('mms_http_requests_total{route="/x"} 1');
  });
});
