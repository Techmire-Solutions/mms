import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiError";
import { computeRetryDelay, shouldRetryQuery } from "./retryPolicy";

describe("shouldRetryQuery", () => {
  it("given deterministic 4xx failures, should stop retrying when asked", () => {
    for (const status of [401, 403, 404, 409, 422, 429]) {
      expect(shouldRetryQuery(0, new ApiError(status, `status ${status}`))).toBe(false);
    }
  });

  it("given a retryable server failure, should allow up to three attempts when asked", () => {
    const serverError = new ApiError(500, "boom");
    expect(shouldRetryQuery(0, serverError)).toBe(true);
    expect(shouldRetryQuery(1, serverError)).toBe(true);
    expect(shouldRetryQuery(2, serverError)).toBe(true);
    expect(shouldRetryQuery(3, serverError)).toBe(false);
  });

  it("given a non-ApiError failure, should keep the existing three-attempt policy when asked", () => {
    expect(shouldRetryQuery(0, new Error("network"))).toBe(true);
    expect(shouldRetryQuery(2, new Error("network"))).toBe(true);
    expect(shouldRetryQuery(3, new Error("network"))).toBe(false);
  });
});

describe("computeRetryDelay", () => {
  it("given Retry-After seconds, should wait the requested interval when asked", () => {
    expect(
      computeRetryDelay(0, new ApiError(429, "slow down", undefined, undefined, undefined, 5)),
    ).toBe(5_000);
    expect(
      computeRetryDelay(1, new ApiError(503, "busy", undefined, undefined, undefined, 0)),
    ).toBe(0);
  });

  it("given a long Retry-After, should cap the wait at 30 seconds when asked", () => {
    expect(
      computeRetryDelay(0, new ApiError(503, "busy", undefined, undefined, undefined, 120)),
    ).toBe(30_000);
  });

  it("given no Retry-After, should fall back to capped exponential backoff when asked", () => {
    expect(computeRetryDelay(0, new ApiError(500, "boom"))).toBe(1_000);
    expect(computeRetryDelay(1, new ApiError(500, "boom"))).toBe(2_000);
    expect(computeRetryDelay(2, new Error("network"))).toBe(4_000);
    expect(computeRetryDelay(10, new Error("network"))).toBe(30_000);
  });
});
