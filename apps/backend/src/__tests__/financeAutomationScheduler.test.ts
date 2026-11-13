import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOverdue = vi.fn();
const mockGenerate = vi.fn();
const mockRevalue = vi.fn();
const mockRestate = vi.fn();
const mockRecordFailure = vi.fn();

vi.mock("../worker/financeAutomationRuns.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../worker/financeAutomationRuns.js")>();
  return {
    ...actual,
    runOverdueMarking: (...args: unknown[]) => mockOverdue(...args),
    generateDueInvoices: (...args: unknown[]) => mockGenerate(...args),
    revalueMonthEnd: (...args: unknown[]) => mockRevalue(...args),
    restateMonthEnd: (...args: unknown[]) => mockRestate(...args),
    recordAutomationFailure: (...args: unknown[]) => mockRecordFailure(...args),
  };
});

const mockPrefs = vi.fn();
vi.mock("../services/financePreferencesService.js", () => ({
  loadFinanceModulePreferences: (...args: unknown[]) => mockPrefs(...args),
}));

vi.mock("../lib/workspaceTimezone.js", () => ({
  getWorkspaceTimezone: vi.fn().mockResolvedValue("UTC"),
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../services/backgroundJobDeadline.js", () => ({
  createJobDeadline: vi.fn(() => ({
    signal: new AbortController().signal,
    timeoutMs: 1000,
    settleMs: 0,
    reasonMessage: () => null,
    dispose: vi.fn(),
  })),
  runWithJobDeadline: (_deadline: unknown, work: () => Promise<unknown>) => work(),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (_tenant: string, work: () => unknown) => work(),
}));

vi.mock("../lib/tenantContext.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/tenantContext.js")>();
  return { ...actual, runWithTenant: (_tenant: string, work: () => unknown) => work() };
});

import {
  hourInTimeZone,
  runFinanceAutomationSweep,
  runWorkspaceAutomation,
} from "../worker/financeAutomationScheduler.js";
import { isLastDayOfMonth, previousBillingPeriod } from "../worker/financeAutomationRuns.js";

const PREFS = {
  autoGenerateInvoice: true,
  overdueReminder: true,
  feeReminders: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrefs.mockResolvedValue(PREFS);
  mockOverdue.mockResolvedValue({ ran: true, detail: "2 marked overdue" });
  mockGenerate.mockResolvedValue({ ran: true, detail: "4 created" });
  mockRevalue.mockResolvedValue({ ran: true, detail: "3 revalued line(s)" });
  mockRestate.mockResolvedValue({ ran: true, detail: "5 restated line(s)" });
  mockRecordFailure.mockResolvedValue(undefined);
});

const abortError = (): Error =>
  Object.assign(new Error("Background job aborted"), { name: "AbortError" });

describe("finance automation calendar helpers", () => {
  it("derives the previous billing period across a year boundary", () => {
    expect(previousBillingPeriod("2026-11-01")).toBe("2026-10");
    expect(previousBillingPeriod("2026-01-01")).toBe("2025-12");
  });

  it("detects month-end for 31- and 30-day months, including February", () => {
    expect(isLastDayOfMonth("2026-11-30")).toBe(true);
    expect(isLastDayOfMonth("2026-11-29")).toBe(false);
    expect(isLastDayOfMonth("2026-02-28")).toBe(true);
    expect(isLastDayOfMonth("2026-04-30")).toBe(true);
  });

  it("reads the local hour in the workspace timezone", () => {
    const instant = new Date("2026-11-01T01:10:00.000Z");
    expect(hourInTimeZone("UTC", instant)).toBe(1);
    expect(hourInTimeZone("Asia/Karachi", instant)).toBe(6);
  });
});

describe("finance automation sweep", () => {
  it("does nothing when the global switch is off", async () => {
    const summary = await runFinanceAutomationSweep({ enabled: false, workspaces: ["a"] });
    expect(summary.scanned).toBe(0);
    expect(mockOverdue).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("marks overdue from the overdue hour and runs the boundary steps from hour 1", async () => {
    mockGenerate.mockResolvedValue({ ran: false, detail: "not the first day" });
    await runFinanceAutomationSweep({
      enabled: true,
      workspaces: ["a"],
      now: new Date("2026-11-15T06:10:00Z"),
    });
    // 06:00 is past the overdue hour (catch-up) and past the boundary hour, but the
    // steps themselves decide by calendar (day 15 → no billing, no month-end).
    expect(mockOverdue).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(
      "a",
      "2026-11-15",
      expect.objectContaining({ autoGenerateInvoice: true }),
    );
  });

  it("does not run the boundary steps before their hour", async () => {
    await runFinanceAutomationSweep({
      enabled: true,
      workspaces: ["a"],
      now: new Date("2026-11-30T00:10:00Z"),
    });
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockRevalue).not.toHaveBeenCalled();
    expect(mockRestate).not.toHaveBeenCalled();
  });

  it("catches up a missed month-end tick later the same local day", async () => {
    // The 01:00 tick was deferred by the budget/shutdown: hour 03 must still run the
    // month-end steps (idempotent by run-per-date) instead of waiting a month.
    mockGenerate.mockResolvedValue({ ran: false, detail: "not the first day" });
    const summary = await runFinanceAutomationSweep({
      enabled: true,
      workspaces: ["a"],
      now: new Date("2026-10-31T03:10:00Z"),
    });
    expect(mockRevalue).toHaveBeenCalledWith("a", "2026-10-31", expect.any(AbortSignal));
    expect(mockRestate).toHaveBeenCalledWith("a", "2026-10-31", expect.any(AbortSignal));
    expect(summary.revaluations).toBe(1);
    expect(summary.restatements).toBe(1);
  });

  it("records a failed revaluation durably and still runs the restatement step", async () => {
    mockGenerate.mockResolvedValue({ ran: false, detail: "not the first day" });
    mockRevalue.mockRejectedValueOnce(new Error("CLOSING rate missing"));
    const summary = await runFinanceAutomationSweep({
      enabled: true,
      workspaces: ["a"],
      now: new Date("2026-10-31T01:10:00Z"),
    });
    expect(mockRecordFailure).toHaveBeenCalledWith(
      "a",
      "2026-10-31",
      "automation-revalue",
      "CLOSING rate missing",
    );
    // One step failing must not skip the next accounting step.
    expect(mockRestate).toHaveBeenCalledTimes(1);
    expect(summary.restatements).toBe(1);
    expect(summary.failed).toEqual([]);
  });

  it("defers the workspace on an abort instead of recording a failure", async () => {
    mockGenerate.mockResolvedValue({ ran: false, detail: "not the first day" });
    mockRevalue.mockRejectedValueOnce(abortError());
    const summary = await runFinanceAutomationSweep({
      enabled: true,
      workspaces: ["a", "b"],
      now: new Date("2026-10-31T01:10:00Z"),
    });
    expect(mockRecordFailure).not.toHaveBeenCalled();
    expect(summary.deferred).toBe(1);
    // The aborted workspace skipped its restatement; the next workspace still ran.
    expect(summary.restatements).toBe(1);
  });

  it("runs billing and period-end steps on the first local day, month end", async () => {
    // 2026-10-31T01:10Z is the last day of October: billing + revaluation + IAS 29.
    mockGenerate.mockResolvedValue({ ran: false, detail: "not the first day" });
    const summary = await runFinanceAutomationSweep({
      enabled: true,
      workspaces: ["a"],
      now: new Date("2026-10-31T01:10:00Z"),
    });
    expect(mockRevalue).toHaveBeenCalledWith("a", "2026-10-31", expect.any(AbortSignal));
    expect(mockRestate).toHaveBeenCalledWith("a", "2026-10-31", expect.any(AbortSignal));
    expect(summary.revaluations).toBe(1);
    expect(summary.restatements).toBe(1);
  });

  it("isolates a failing workspace and continues the sweep", async () => {
    // A failure outside the steps (loading prefs/timezone) must not stop the sweep.
    mockPrefs.mockRejectedValueOnce(new Error("tenant A is broken")).mockResolvedValueOnce(PREFS);
    const summary = await runFinanceAutomationSweep({
      enabled: true,
      workspaces: ["a", "b"],
      now: new Date("2026-11-15T06:10:00Z"),
    });
    expect(summary.failed).toEqual([{ workspace: "a", reason: "tenant A is broken" }]);
    expect(summary.scanned).toBe(1);
    expect(mockOverdue).toHaveBeenCalledTimes(1);
  });

  it("stops between workspaces when shutdown fires", async () => {
    let calls = 0;
    const summary = await runFinanceAutomationSweep({
      enabled: true,
      workspaces: ["a", "b", "c"],
      now: new Date("2026-11-15T06:10:00Z"),
      shouldContinue: () => {
        calls += 1;
        return calls < 2;
      },
    });
    // The first workspace is entered; the second check stops before workspace b.
    expect(summary.scanned).toBe(1);
    expect(summary.deferred).toBe(2);
  });

  it("respects the tenant preferences", async () => {
    mockPrefs.mockResolvedValue({ ...PREFS, overdueReminder: false, feeReminders: false });
    await runWorkspaceAutomation("a", new Date("2026-11-15T06:10:00Z"));
    expect(mockOverdue).toHaveBeenCalledWith(
      "a",
      "2026-11-15",
      expect.objectContaining({ overdueReminder: false, feeReminders: false }),
    );
  });
});
