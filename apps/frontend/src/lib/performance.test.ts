import { describe, it, expect, vi } from "vitest";
import { yieldToMain, getVisibilityInfo } from "./performance";

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

describe("getVisibilityInfo", () => {
  it("detects initially backgrounded tab using Performance API entry", () => {
    const originalGetEntriesByType = performance.getEntriesByType;
    performance.getEntriesByType = vi.fn().mockImplementation((type: string) => {
      if (type === "visibility-state") {
        return [
          { name: "hidden", startTime: 120 },
          { name: "visible", startTime: 450 },
        ];
      }
      return [];
    });

    const info = getVisibilityInfo();
    expect(info.initiallyBackgrounded).toBe(true);
    expect(info.timeBackgrounded).toBe(120);

    performance.getEntriesByType = originalGetEntriesByType;
  });

  it("detects initially foregrounded tab when first entry is visible", () => {
    const originalGetEntriesByType = performance.getEntriesByType;
    performance.getEntriesByType = vi.fn().mockImplementation((type: string) => {
      if (type === "visibility-state") {
        return [{ name: "visible", startTime: 0 }];
      }
      return [];
    });

    const info = getVisibilityInfo();
    expect(info.initiallyBackgrounded).toBe(false);
    expect(info.timeBackgrounded).toBeNull();

    performance.getEntriesByType = originalGetEntriesByType;
  });

  it("falls back to document.visibilityState when Performance API returns no entries", () => {
    const originalGetEntriesByType = performance.getEntriesByType;
    performance.getEntriesByType = vi.fn().mockReturnValue([]);

    const info = getVisibilityInfo();
    expect(info.initiallyBackgrounded).toBe(document.visibilityState === "hidden");

    performance.getEntriesByType = originalGetEntriesByType;
  });
});
