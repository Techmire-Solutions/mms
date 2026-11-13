import { describe, expect, it, vi } from "vitest";

const mockWorkspaceToday = vi.hoisted(() => vi.fn());
const mockPreferences = vi.hoisted(() => vi.fn());

vi.mock("../lib/workspaceDay.js", () => ({
  workspaceTodayIso: mockWorkspaceToday,
}));
vi.mock("../db/repositories/accountingModulePreferencesRepository.js", () => ({
  getAccountingModulePreferences: mockPreferences,
}));

import { resolveVoucherPeriod } from "../db/repositories/accountingVoucherPeriod.js";

/**
 * When the request has no `date`, the numbering preview must use the workspace's
 * business day. The UTC day is still yesterday for a UTC+5 tenant until 05:00
 * local, so the preview showed the previous rollover year's number.
 */
describe("resolveVoucherPeriod", () => {
  const tx = {} as never;
  const config = { rolloverPolicy: "annual_calendar" } as never;

  it("uses the workspace day for an omitted date", async () => {
    mockWorkspaceToday.mockResolvedValue("2026-01-01");

    const period = await resolveVoucherPeriod(tx, "demo", config, undefined);

    expect(mockWorkspaceToday).toHaveBeenCalledWith("demo");
    expect(period).toEqual({ periodYear: 2026, printYear: 2026 });
  });

  it("keeps the last calendar day of the old year on the old year", async () => {
    mockWorkspaceToday.mockResolvedValue("2025-12-31");

    const period = await resolveVoucherPeriod(tx, "demo", config, undefined);

    expect(period).toEqual({ periodYear: 2025, printYear: 2025 });
  });
});
