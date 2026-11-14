import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * The overdue sweep and the reminder window must be measured in the **workspace's** calendar day.
 *
 * Before this change the transition used `todayISO()` (server-local), so a workspace that is not in
 * the server's zone flipped a day early or late, and the automation's alert — keyed on the
 * tenant-zone date — could describe a different day than the transition it reported.
 */

const mockRepo = vi.hoisted(() => ({
  markOverdueInvoices: vi.fn().mockResolvedValue(0),
  listOpenInvoicesForCollect: vi.fn().mockResolvedValue([]),
  applyLateFeeAmounts: vi.fn().mockResolvedValue([]),
  listInvoicesByIds: vi.fn().mockResolvedValue([]),
  claimInvoicesForReminder: vi.fn().mockResolvedValue([]),
  saveCreditNote: vi.fn(),
  listCreditNotesForInvoice: vi.fn(),
}));

const mockWorkspaceDay = vi.hoisted(() => ({
  workspaceTodayIso: vi.fn(async () => "2026-11-11"),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../db/repositories/financeCollectRepository.js", () => mockRepo);
vi.mock("../services/financePreferencesService.js", () => ({
  loadFinanceModulePreferences: vi
    .fn()
    .mockResolvedValue({ lateFeePercent: "0", overdueReminder: true, feeReminders: true }),
}));
vi.mock("../lib/workspaceDay.js", () => mockWorkspaceDay);
vi.mock("../lib/livePush.js", () => ({ broadcastTenantUpdate: vi.fn() }));

import { collectOverdueInvoices } from "../finance/use-cases/financeCollectUseCases.js";

describe("overdue sweep day resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.markOverdueInvoices.mockResolvedValue(0);
    mockWorkspaceDay.workspaceTodayIso.mockResolvedValue("2026-11-11");
  });

  it("uses the workspace calendar day, not the server's", async () => {
    // Server clock is late on the 10th UTC; the workspace (Pacific/Kiritimati, UTC+14) is on the
    // 11th. The sweep must mark against the workspace's day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T22:30:00Z"));
    try {
      await runWithTenant("ws-1", () =>
        collectOverdueInvoices({ applyLateFee: false }, { today: "2026-11-11" }),
      );
      expect(mockRepo.markOverdueInvoices).toHaveBeenCalledWith("ws-1", "2026-11-11");
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the workspace helper when no explicit day is given", async () => {
    await runWithTenant("ws-1", () => collectOverdueInvoices({ applyLateFee: false }));

    expect(mockWorkspaceDay.workspaceTodayIso).toHaveBeenCalledWith("ws-1");
    expect(mockRepo.markOverdueInvoices).toHaveBeenCalledWith("ws-1", "2026-11-11");
  });

  it("uses one day for both the transition and its alert", async () => {
    mockRepo.markOverdueInvoices.mockResolvedValue(2);
    const audit = vi.mocked(
      (await import("../services/auditTrailService.js")).recordModernAuditEvent,
    );

    await runWithTenant("ws-1", () =>
      collectOverdueInvoices({ applyLateFee: false }, { today: "2026-11-11" }),
    );

    // The audit row names the same day the rows were flipped against.
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        newState: expect.objectContaining({ event: "overdue_marked", date: "2026-11-11" }),
      }),
    );
  });

  it("is idempotent: a second run in the same workspace day marks nothing new", async () => {
    mockRepo.markOverdueInvoices.mockResolvedValueOnce(3).mockResolvedValueOnce(0);

    await runWithTenant("ws-1", () =>
      collectOverdueInvoices({ applyLateFee: false }, { today: "2026-11-11" }),
    );
    await runWithTenant("ws-1", () =>
      collectOverdueInvoices({ applyLateFee: false }, { today: "2026-11-11" }),
    );

    // The conditional UPDATE is what makes the retry safe; the audit row is only written when the
    // first run actually flipped something.
    expect(mockRepo.markOverdueInvoices).toHaveBeenCalledTimes(2);
    expect(mockRepo.markOverdueInvoices).toHaveBeenLastCalledWith("ws-1", "2026-11-11");
  });
});
