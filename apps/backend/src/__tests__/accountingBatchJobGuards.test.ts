import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLock = vi.fn();
const mockFindRunId = vi.fn();
const mockPostEntry = vi.fn();
const mockSaveRun = vi.fn();
const mockAudit = vi.fn();

vi.mock("../accounting/ledgerPosting/ledgerEventLock.js", () => ({
  lockLedgerEvent: (...args: unknown[]) => mockLock(...args),
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  postFxRevaluation,
  type FxRevaluationDeps,
} from "../accounting/use-cases/fxRevaluationUseCases.js";
import { postIas29Restatement } from "../accounting/use-cases/ias29UseCases.js";
import { mapDatabaseErrorCode } from "../lib/dbErrorMapping.js";
import { withTimeout } from "../worker/sweepSupport.js";

const aborted = (): AbortSignal => {
  const controller = new AbortController();
  controller.abort("shutdown");
  return controller.signal;
};

const fxDeps = (): FxRevaluationDeps =>
  ({
    fx: {},
    listBalances: vi.fn(),
    listRuns: vi.fn().mockResolvedValue([]),
    findRunId: mockFindRunId,
    saveRun: mockSaveRun,
    getPostingRules: vi.fn(),
    postEntry: mockPostEntry,
    buildEntry: vi.fn(),
    recordAudit: mockAudit,
  }) as unknown as FxRevaluationDeps;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindRunId.mockResolvedValue(null);
  mockSaveRun.mockResolvedValue(undefined);
  mockAudit.mockResolvedValue(undefined);
});

describe("accounting batch jobs respect the abort signal", () => {
  it("refuses to take the revaluation lock at all when already aborted", async () => {
    await expect(
      postFxRevaluation(fxDeps(), { tenant: "demo", userId: "system" }, "2026-10-31", {
        signal: aborted(),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(mockLock).not.toHaveBeenCalled();
    expect(mockPostEntry).not.toHaveBeenCalled();
    expect(mockSaveRun).not.toHaveBeenCalled();
  });

  it("stops the IAS 29 restatement before its first write when aborted", async () => {
    const store = {
      findIas29RunId: vi.fn(),
      listIas29Runs: vi.fn(),
      getHyperinflationSettings: vi.fn(),
      getCurrencySettings: vi.fn(),
      saveIas29Run: mockSaveRun,
    };
    await expect(
      postIas29Restatement(
        {
          store,
          postEntry: mockPostEntry,
          buildEntry: vi.fn(),
          recordAudit: mockAudit,
        } as never,
        { tenant: "demo", userId: "system" },
        "2026-10-31",
        { signal: aborted() },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(mockLock).not.toHaveBeenCalled();
    expect(store.findIas29RunId).not.toHaveBeenCalled();
  });
});

describe("lock and statement-timeout failures are retryable", () => {
  it("maps a lock wait (55P03) to 409 and a cancelled statement (57014) to 503", () => {
    expect(mapDatabaseErrorCode("55P03")).toMatchObject({
      status: 409,
      type: "lock_timeout",
      message: expect.stringMatching(/retry/i),
    });
    expect(mapDatabaseErrorCode("57014")).toMatchObject({
      status: 503,
      type: "query_cancelled",
      message: expect.stringMatching(/retry/i),
    });
  });
});

describe("sweep timeout", () => {
  it("aborts the work before rejecting so nothing keeps writing after the budget", async () => {
    const onTimeout = vi.fn();
    const slow = new Promise<void>((resolve) => setTimeout(resolve, 50));
    await expect(withTimeout(slow, 5, "workspace a", onTimeout)).rejects.toThrow(
      /workspace a timed out after 5ms/,
    );
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("returns the value when the work settles in time", async () => {
    const onTimeout = vi.fn();
    await expect(withTimeout(Promise.resolve("ok"), 50, "workspace a", onTimeout)).resolves.toBe(
      "ok",
    );
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
