import { describe, expect, it } from "vitest";
import {
  DEFAULT_WARN_BEFORE_MS,
  MAX_SESSION_IDLE_MINUTES,
  resolvePlatformSessionPolicy,
  resolveTenantSessionPolicy,
} from "./sessionPolicy.js";

describe("sessionPolicy", () => {
  it("defaults a missing tenant timeout to 60 minutes", () => {
    const p = resolveTenantSessionPolicy(0);
    expect(p.idleMs).toBe(60 * 60 * 1000);
    expect(p.warnBeforeMs).toBeLessThanOrEqual(p.idleMs);
    expect(p.absoluteMs).toBeNull();
  });

  it("resolves a valid tenant timeout and warns within the idle window", () => {
    const p = resolveTenantSessionPolicy(120);
    expect(p.idleMs).toBe(120 * 60 * 1000);
    expect(p.warnBeforeMs).toBe(DEFAULT_WARN_BEFORE_MS);
    expect(p.warnBeforeMs).toBeLessThan(p.idleMs);
  });

  it("caps an oversized tenant timeout at 24h", () => {
    const p = resolveTenantSessionPolicy(10_000);
    expect(p.idleMs).toBe(MAX_SESSION_IDLE_MINUTES * 60 * 1000);
  });

  it("defaults a missing platform timeout to 30 minutes", () => {
    const p = resolvePlatformSessionPolicy(0);
    expect(p.idleMs).toBe(30 * 60 * 1000);
  });

  it("honors a configured warning lead time for the platform", () => {
    const p = resolvePlatformSessionPolicy(60, 15);
    expect(p.idleMs).toBe(60 * 60 * 1000);
    expect(p.warnBeforeMs).toBe(15 * 1000);
  });

  it("resolves an absolute session cap and leaves it null when unset", () => {
    expect(resolveTenantSessionPolicy(60, undefined, 480).absoluteMs).toBe(8 * 60 * 60 * 1000);
    expect(resolvePlatformSessionPolicy(30, undefined, 0).absoluteMs).toBeNull();
  });
});
