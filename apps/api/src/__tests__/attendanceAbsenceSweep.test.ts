import { describe, expect, it } from "vitest";
import { runWorkspaceSweeps, withTimeout } from "../worker/attendanceAbsenceScheduler.js";

/**
 * Sweep robustness: one workspace must never stop the others, a hung scan must not hold the sweep,
 * and the summary must report failures instead of looking like a clean run.
 */

const ok = (raised = 1) => ({
  alertsRaised: raised,
  alertsUpdated: 0,
  notificationsCapped: false,
});

describe("withTimeout", () => {
  it("resolves a fast promise", async () => {
    await expect(withTimeout(Promise.resolve("done"), 50, "fast")).resolves.toBe("done");
  });

  it("rejects a promise that never settles", async () => {
    await expect(withTimeout(new Promise<never>(() => {}), 5, "hung scan")).rejects.toThrow(
      /hung scan timed out/,
    );
  });

  it("clears its timer so the process can exit", async () => {
    // A leaked timer would keep the process alive; this asserts the helper returns promptly.
    const started = Date.now();
    await withTimeout(Promise.resolve(1), 10_000, "timed");
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("runWorkspaceSweeps", () => {
  it("continues after a failing workspace and reports it", async () => {
    const scanned: string[] = [];
    const summary = await runWorkspaceSweeps(["a", "b", "c"], async (workspace) => {
      scanned.push(workspace);
      if (workspace === "b") throw new Error("connection reset");
      return ok();
    });

    expect(scanned).toEqual(["a", "b", "c"]);
    expect(summary.scanned).toBe(2);
    expect(summary.failed).toEqual([{ workspace: "b", reason: "connection reset" }]);
    expect(summary.alertsRaised).toBe(2);
  });

  it("times out a hung workspace and still scans the next one", async () => {
    const summary = await runWorkspaceSweeps(
      ["slow", "fast"],
      async (workspace) => {
        if (workspace === "slow") return new Promise<never>(() => {});
        return ok(3);
      },
      { workspaceTimeoutMs: 5 },
    );

    expect(summary.scanned).toBe(1);
    expect(summary.alertsRaised).toBe(3);
    expect(summary.failed[0]?.workspace).toBe("slow");
    expect(summary.failed[0]?.reason).toMatch(/timed out/);
  });

  it("defers the remaining workspaces when the sweep budget is exhausted", async () => {
    let clock = 0;
    const summary = await runWorkspaceSweeps(
      ["a", "b", "c", "d"],
      async () => {
        clock += 40_000;
        return ok();
      },
      { sweepBudgetMs: 60_000, now: () => clock },
    );

    expect(summary.deferred).toBeGreaterThan(0);
    // Whatever was deferred was not scanned and not failed.
    expect(summary.scanned + summary.failed.length + summary.deferred).toBe(4);
  });

  it("counts capped scans", async () => {
    const summary = await runWorkspaceSweeps(["a"], async () => ({
      alertsRaised: 0,
      alertsUpdated: 2,
      notificationsCapped: true,
    }));
    expect(summary.notificationsCapped).toBe(1);
    expect(summary.alertsUpdated).toBe(2);
  });

  it("returns a clean summary for zero workspaces", async () => {
    const summary = await runWorkspaceSweeps([], async () => ok());
    expect(summary).toMatchObject({ workspaces: 0, scanned: 0, failed: [] });
  });
});
