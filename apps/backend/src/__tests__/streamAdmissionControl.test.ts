import fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { createConcurrencyLimiter } from "../lib/concurrencyLimiter.js";
import { createStreamAdmissionControl } from "../lib/streamAdmissionControl.js";

describe("createConcurrencyLimiter", () => {
  it("hands out at most `max` slots and reuses them after release", () => {
    const limiter = createConcurrencyLimiter(2);

    const a = limiter.tryAcquire();
    const b = limiter.tryAcquire();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(limiter.inFlight()).toBe(2);

    // Third caller is refused rather than queued.
    expect(limiter.tryAcquire()).toBeNull();
    expect(limiter.inFlight()).toBe(2);

    a!();
    expect(limiter.inFlight()).toBe(1);
    expect(limiter.tryAcquire()).not.toBeNull();
    expect(limiter.inFlight()).toBe(2);
  });

  it("treats release as idempotent so a double release cannot inflate capacity", () => {
    const limiter = createConcurrencyLimiter(1);
    const release = limiter.tryAcquire()!;
    release();
    release();
    release();
    expect(limiter.inFlight()).toBe(0);
    expect(limiter.tryAcquire()).not.toBeNull();
    expect(limiter.inFlight()).toBe(1);
  });

  it("clamps a nonsensical limit to at least one slot", () => {
    const limiter = createConcurrencyLimiter(0);
    expect(limiter.tryAcquire()).not.toBeNull();
    expect(limiter.tryAcquire()).toBeNull();
  });
});

describe("stream admission control", () => {
  const apps: ReturnType<typeof fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  /**
   * Snapshot/backup responses hold a pooled DB client for the whole stream, so
   * the cap is what stops a few concurrent downloads from exhausting the pool.
   * Excess requests must be shed with 503 + Retry-After rather than queued.
   */
  it("sheds the request past the cap with 503 and Retry-After", async () => {
    const app = fastify({ logger: false });
    apps.push(app);

    const admission = createStreamAdmissionControl({
      limit: 2,
      retryAfterSeconds: 30,
      unavailableMessage: "Too many snapshot downloads are in progress. Please retry shortly.",
    });

    // A stream that stays open until we end it, standing in for a long download.
    const openStreams: Array<() => void> = [];

    app.get("/backup", async (_request, reply) => {
      const release = admission.acquire(reply);
      if (!release) return;
      const stream = new Readable({ read() {} });
      // Releasing on 'close' mirrors streamSnapshotRoute's finally block, which
      // runs on clean completion and on client disconnect alike.
      stream.on("close", release);
      openStreams.push(() => stream.push(null));
      reply.header("Content-Type", "application/json; charset=utf-8");
      return reply.send(stream);
    });

    // Two in-flight downloads consume the whole budget.
    const first = app.inject({ method: "GET", url: "/backup" });
    const second = app.inject({ method: "GET", url: "/backup" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(admission.inFlight()).toBe(2);

    // The third is refused.
    const third = await app.inject({ method: "GET", url: "/backup" });
    expect(third.statusCode).toBe(503);
    expect(third.headers["retry-after"]).toBe("30");
    expect(third.json()).toEqual({
      type: "snapshot_unavailable",
      message: "Too many snapshot downloads are in progress. Please retry shortly.",
    });

    // Draining a download frees its slot for the next caller.
    openStreams.forEach((end) => end());
    await Promise.all([first, second]);
    expect(admission.inFlight()).toBe(0);

    const fourth = app.inject({ method: "GET", url: "/backup" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(admission.inFlight()).toBe(1);
    openStreams.forEach((end) => end());
    const fourthResponse = await fourth;
    expect(fourthResponse.statusCode).toBe(200);
  });

  it("releases the slot when the client disconnects mid-stream", async () => {
    const app = fastify({ logger: false });
    apps.push(app);

    const admission = createStreamAdmissionControl({ limit: 1 });

    // Held on an object so TS control-flow analysis does not narrow it to null
    // at the call site (it is assigned inside the route closure).
    const pending: { close: (() => void) | null } = { close: null };
    app.get("/backup", async (_request, reply) => {
      const release = admission.acquire(reply);
      if (!release) return;
      const stream = new Readable({ read() {} });
      stream.on("close", release);
      pending.close = () => stream.destroy();
      return reply.send(stream);
    });

    const inFlight = app.inject({ method: "GET", url: "/backup" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(admission.inFlight()).toBe(1);

    // Abandoning the response must not leak the slot, or the endpoint would
    // eventually refuse every request permanently.
    pending.close?.();
    await inFlight.catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(admission.inFlight()).toBe(0);
  });
});
