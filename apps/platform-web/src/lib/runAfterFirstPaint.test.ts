import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAfterFirstPaint } from "./runAfterFirstPaint";

describe("runAfterFirstPaint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes callback after animation frames and idle/timer", () => {
    const cb = vi.fn();
    runAfterFirstPaint(cb);

    expect(cb).not.toHaveBeenCalled();

    // Advance timers & animation frames
    vi.runAllTimers();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not execute callback if cancelled early", () => {
    const cb = vi.fn();
    const cancel = runAfterFirstPaint(cb);

    cancel();
    vi.runAllTimers();
    expect(cb).not.toHaveBeenCalled();
  });
});
