import { describe, it, expect, vi } from "vitest";
import { yieldToMain } from "./performance";

describe("yieldToMain", () => {
  it("does not yield if deadline has not passed", async () => {
    const futureDeadline = performance.now() + 1000;
    const nextDeadline = await yieldToMain(futureDeadline);
    expect(nextDeadline).toBe(futureDeadline);
  });

  it("yields and updates deadline when deadline has passed", async () => {
    const pastDeadline = performance.now() - 10;
    const nextDeadline = await yieldToMain(pastDeadline, 60);

    expect(nextDeadline).toBeGreaterThan(performance.now());
    expect(nextDeadline).toBeGreaterThanOrEqual(pastDeadline + 50);
  });

  it("uses scheduler.yield when available in window", async () => {
    const yieldSpy = vi.fn().mockResolvedValue(undefined);
    const originalScheduler = (window as unknown as { scheduler?: unknown }).scheduler;
    (window as unknown as { scheduler?: unknown }).scheduler = { yield: yieldSpy };

    const pastDeadline = performance.now() - 5;
    await yieldToMain(pastDeadline);

    expect(yieldSpy).toHaveBeenCalled();

    (window as unknown as { scheduler?: unknown }).scheduler = originalScheduler;
  });
});
