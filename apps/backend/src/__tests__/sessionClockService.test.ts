import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionClockThrottleForTests,
  isSessionAbsoluteExpired,
  isSessionIdleExpired,
  platformSessionScope,
  resetSessionClock,
  revokeSession,
  sessionLastActivityMs,
  sessionStartedAtMs,
  tenantSessionScope,
  touchSession,
} from "../services/sessionClockService.js";
import { clearInMemoryRedisFallback } from "../lib/redis.js";

describe("sessionClockService", () => {
  beforeEach(() => {
    clearInMemoryRedisFallback();
    clearSessionClockThrottleForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records last activity on touch", async () => {
    await touchSession("tn:t:u1", 60_000, true);
    const last = await sessionLastActivityMs("tn:t:u1");
    expect(last).toBeTypeOf("number");
    expect(last as number).toBeGreaterThan(Date.now() - 5000);
  });

  it("resets stale clock on resetSessionClock", async () => {
    // Simulate an old touch from 1 hour ago
    await touchSession("plat:p1", 60_000, true);
    expect(await isSessionIdleExpired("plat:p1", 0)).toBe(true);

    // Reset session clock on new login
    await resetSessionClock("plat:p1", 60_000);
    expect(await isSessionIdleExpired("plat:p1", 60_000)).toBe(false);
    const started = await sessionStartedAtMs("plat:p1");
    expect(started).toBeGreaterThan(Date.now() - 5000);
  });

  it("does not report idle-expired shortly after touch", async () => {
    await touchSession("tn:t:u1", 60_000, true);
    expect(await isSessionIdleExpired("tn:t:u1", 60_000)).toBe(false);
  });

  it("reports idle-expired once the idle window has elapsed", async () => {
    await touchSession("tn:t:u1", 60_000, true);
    // A zero remaining window means "already past the deadline".
    expect(await isSessionIdleExpired("tn:t:u1", 0)).toBe(true);
  });

  it("is not idle-expired when no activity record exists yet", async () => {
    expect(await isSessionIdleExpired("tn:t:missing", 60_000)).toBe(false);
  });

  it("records the session start and is not absolute-expired under the cap", async () => {
    await touchSession("tn:t:u1", 60_000, true);
    const started = await sessionStartedAtMs("tn:t:u1");
    expect(started).toBeTypeOf("number");
    expect(started as number).toBeGreaterThan(Date.now() - 5000);
    expect(await isSessionAbsoluteExpired("tn:t:u1", null)).toBe(false);
    expect(await isSessionAbsoluteExpired("tn:t:u1", 7 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("is never absolute-expired without a cap or without a record", async () => {
    expect(await isSessionAbsoluteExpired("tn:t:u1", null)).toBe(false);
    expect(await isSessionAbsoluteExpired("tn:t:missing", 60_000)).toBe(false);
  });

  it("clears the clock on revoke", async () => {
    await touchSession("tn:t:u1", 60_000, true);
    await revokeSession("tn:t:u1");
    expect(await sessionLastActivityMs("tn:t:u1")).toBeNull();
  });

  it("builds tenant and platform scope keys", () => {
    expect(tenantSessionScope("Foo.localhost", "u1")).toBe("tn:foo.localhost:u1");
    expect(platformSessionScope("u1")).toBe("plat:u1");
  });
});
