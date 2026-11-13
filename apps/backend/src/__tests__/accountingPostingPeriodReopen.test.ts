import { describe, expect, it, vi, beforeEach } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * Lock ordering for the monthly lock.
 *
 * The reopen used to read the fiscal year and only then take the advisory lock that
 * every posting path and the year-end close share. A close that committed while the
 * reopen waited left an *open* period inside a *closed* fiscal year — the exact state
 * the monthly lock exists to prevent. The rule (`mms-finance-accounting` ledger
 * controls) is: acquire the lock before reading the state the decision uses.
 */

const repo = vi.hoisted(() => ({
  findPostingPeriodById: vi.fn(),
  findFiscalYearById: vi.fn(),
  setPostingPeriodStatus: vi.fn(),
  listPostingPeriods: vi.fn(),
}));

const lock = vi.hoisted(() => ({ lockFiscalYearForPosting: vi.fn() }));
const audit = vi.hoisted(() => ({ recordModernAuditEvent: vi.fn() }));
const livePush = vi.hoisted(() => ({ broadcastTenantUpdate: vi.fn() }));

vi.mock("../accounting/repository/accountingRepositoryAdapter.js", () => ({
  accountingRepository: repo,
}));
vi.mock("../accounting/ledgerPosting/fiscalYearPostingLock.js", () => lock);
vi.mock("../services/auditTrailService.js", () => audit);
vi.mock("../lib/livePush.js", () => livePush);

import {
  closePostingPeriod,
  reopenPostingPeriod,
} from "../accounting/use-cases/accountingPostingPeriodUseCases.js";

const PERIOD = {
  id: "p-2026-01",
  fiscalYearId: "fy-2026",
  label: "2026-01",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  status: "closed" as const,
  closedAt: "2026-02-01T00:00:00.000Z",
  closedBy: "u1",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

describe("posting-period lock ordering", () => {
  const order: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    order.length = 0;
    repo.findPostingPeriodById.mockImplementation(async () => {
      order.push("read:period");
      return PERIOD;
    });
    repo.findFiscalYearById.mockImplementation(async () => {
      order.push("read:year");
      return { id: "fy-2026", label: "FY 2026", status: "active" };
    });
    repo.setPostingPeriodStatus.mockImplementation(async (_t, _id, status) => {
      order.push(`write:${status}`);
      return { ...PERIOD, status, closedAt: null, closedBy: null };
    });
    lock.lockFiscalYearForPosting.mockImplementation(async () => {
      order.push("lock");
    });
    audit.recordModernAuditEvent.mockResolvedValue(undefined);
  });

  it("locks before the reads that decide whether the reopen is allowed", async () => {
    const reopened = await runWithTenant("t-1", () => reopenPostingPeriod("p-2026-01", "u2"));

    expect(reopened.status).toBe("open");
    const lockIndex = order.indexOf("lock");
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    // The validating reads happen after the lock; only the lookup that discovers the
    // fiscal year may precede it.
    expect(order.indexOf("read:year")).toBeGreaterThan(lockIndex);
    expect(order.lastIndexOf("read:period")).toBeGreaterThan(lockIndex);
    expect(order.at(-1)).toBe("write:open");
  });

  it("refuses to reopen a period whose fiscal year is closed (read after the lock)", async () => {
    repo.findFiscalYearById.mockImplementation(async () => {
      order.push("read:year");
      return { id: "fy-2026", label: "FY 2026", status: "closed" };
    });

    await expect(
      runWithTenant("t-1", () => reopenPostingPeriod("p-2026-01", "u2")),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(repo.setPostingPeriodStatus).not.toHaveBeenCalled();
    expect(order).not.toContain("write:open");
  });

  it("serializes with the close on the period's own fiscal year", async () => {
    // The key must be the fiscal year the period belongs to: that is the lock the
    // year-end close and every posting path hold.
    await runWithTenant("t-1", () => reopenPostingPeriod("p-2026-01", "u2"));
    expect(lock.lockFiscalYearForPosting).toHaveBeenCalledWith("t-1", ["fy-2026"]);
    // The write uses the values from the post-lock read, not the pre-lock lookup.
    expect(repo.setPostingPeriodStatus).toHaveBeenCalledWith("t-1", "p-2026-01", "open", "u2");
  });

  it("keeps close-then-read ordering when closing a period", async () => {
    repo.findPostingPeriodById.mockImplementation(async () => {
      order.push("read:period");
      return { ...PERIOD, status: "open" as const, closedAt: null, closedBy: null };
    });

    await runWithTenant("t-1", () => closePostingPeriod("p-2026-01", "u2"));

    expect(order.indexOf("lock")).toBeLessThan(order.lastIndexOf("read:period"));
    expect(order.at(-1)).toBe("write:closed");
  });
});
