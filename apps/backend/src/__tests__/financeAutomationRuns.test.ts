import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWithTenant = vi.fn();
let lastOptions: { statementTimeoutMs?: number; lockTimeoutMs?: number } | undefined;
const mockPostFx = vi.fn();
const mockPostIas29 = vi.fn();
const mockAudit = vi.fn();
const mockNotify = vi.fn();
const mockSettings = vi.fn();

vi.mock("../db/tenant-context.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/tenant-context.js")>();
  return { ...actual, withTenant: (...args: unknown[]) => mockWithTenant(...args) };
});

vi.mock("../accounting/use-cases/fxRevaluationUseCases.js", () => ({
  postFxRevaluation: (...args: unknown[]) => mockPostFx(...args),
}));

vi.mock("../accounting/use-cases/ias29UseCases.js", () => ({
  postIas29Restatement: (...args: unknown[]) => mockPostIas29(...args),
}));

vi.mock("../accounting/use-cases/ias29Deps.js", () => ({
  ias29Deps: {
    store: { getHyperinflationSettings: (...args: unknown[]) => mockSettings(...args) },
  },
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (...args: unknown[]) => mockAudit(...args),
}));

vi.mock("../notifications/use-cases/notificationsUseCases.js", () => ({
  notificationsUseCases: {
    notify: (...args: unknown[]) => mockNotify(...args),
  },
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  isAbortLike,
  recordAutomationFailure,
  restateMonthEnd,
  revalueMonthEnd,
} from "../worker/financeAutomationRuns.js";

const RUN = { lines: [{ accountId: "a" }, { accountId: "b" }] };

beforeEach(() => {
  vi.clearAllMocks();
  lastOptions = undefined;
  mockWithTenant.mockImplementation(
    async (
      _tenant: string,
      work: () => Promise<unknown>,
      options?: { statementTimeoutMs?: number; lockTimeoutMs?: number },
    ) => {
      lastOptions = options;
      return work();
    },
  );
  mockPostFx.mockResolvedValue(RUN);
  mockPostIas29.mockResolvedValue(RUN);
  mockAudit.mockResolvedValue(undefined);
  mockNotify.mockResolvedValue(true);
  mockSettings.mockResolvedValue({ enabled: true, appliesFrom: null });
});

describe("accounting automation steps post in one transaction", () => {
  it("wraps the revaluation in a single tenant transaction with a lock budget", async () => {
    const signal = new AbortController().signal;
    const result = await revalueMonthEnd("demo", "2026-10-31", signal);

    // One withTenant call: the advisory lock, both entries, the run row and the audit
    // row share it, so a crash cannot leave a revaluation without its reversal.
    expect(mockWithTenant).toHaveBeenCalledTimes(1);
    expect(mockWithTenant).toHaveBeenCalledWith("demo", expect.any(Function), {
      statementTimeoutMs: expect.any(Number),
      lockTimeoutMs: 10_000,
    });
    expect(lastOptions?.statementTimeoutMs).toBeGreaterThan(30_000);
    expect(mockPostFx).toHaveBeenCalledWith(
      expect.anything(),
      { tenant: "demo", userId: "system" },
      "2026-10-31",
      { signal },
    );
    expect(result).toEqual({ ran: true, detail: "2 revalued line(s)" });
  });

  it("wraps the IAS 29 restatement the same way", async () => {
    mockWithTenant.mockImplementation(async (_tenant: string, work: () => Promise<unknown>) =>
      work(),
    );
    await restateMonthEnd("demo", "2026-10-31");
    expect(mockWithTenant).toHaveBeenCalledTimes(2); // settings read + one post transaction
    expect(mockPostIas29).toHaveBeenCalledWith(
      expect.anything(),
      { tenant: "demo", userId: "system" },
      "2026-10-31",
      { signal: undefined },
    );
  });

  it("skips off-calendar dates without opening a transaction", async () => {
    expect(await revalueMonthEnd("demo", "2026-10-15")).toEqual({
      ran: false,
      detail: "not the last day of the month",
    });
    expect(mockWithTenant).not.toHaveBeenCalled();
  });

  it("propagates an abort instead of swallowing it as skippable", async () => {
    mockPostFx.mockRejectedValueOnce(
      Object.assign(new Error("Background job aborted"), { name: "AbortError" }),
    );
    await expect(revalueMonthEnd("demo", "2026-10-31")).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("still skips a configuration rejection (422) without failing the sweep", async () => {
    mockPostFx.mockRejectedValueOnce(
      Object.assign(new Error("CLOSING rate missing"), { statusCode: 422 }),
    );
    await expect(revalueMonthEnd("demo", "2026-10-31")).resolves.toEqual({
      ran: false,
      detail: "CLOSING rate missing",
    });
  });
});

describe("accounting automation failure records", () => {
  it("writes an audit row on the ledger table and one deduped notification", async () => {
    await recordAutomationFailure("demo", "2026-10-31", "automation-revalue", "rate missing");

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "accounting_fx_revaluation_runs",
        recordId: "automation:2026-10-31",
        actionType: "UPDATE",
        realUserId: "system",
        newState: expect.objectContaining({
          tag: "accounting.automation.failed",
          kind: "automation-revalue",
          reason: "rate missing",
        }),
      }),
    );
    expect(mockNotify).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        kind: "accounting_automation_failed",
        audiencePermission: "accounting.read",
        dedupeKey: "accounting-automation:demo:2026-10-31:automation-revalue",
      }),
    );
  });

  it("never lets a failed audit write block the sweep", async () => {
    mockAudit.mockRejectedValueOnce(new Error("audit db down"));
    await expect(
      recordAutomationFailure("demo", "2026-10-31", "automation-ias29", "index missing"),
    ).resolves.toBeUndefined();
    expect(mockNotify).toHaveBeenCalled();
  });

  it("classifies abort vs deadline errors", () => {
    expect(isAbortLike(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
    expect(isAbortLike(Object.assign(new Error("x"), { name: "JobDeadlineExceededError" }))).toBe(
      true,
    );
    expect(isAbortLike(new Error("boom"))).toBe(false);
  });
});
