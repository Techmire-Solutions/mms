import { describe, expect, it, vi } from "vitest";
import type { FxRevaluationRun } from "@mms/shared";
import { buildFxReport, type FxReportDeps } from "../accounting/use-cases/fxReportUseCases.js";

/**
 * The FX report is a period disclosure: it must ask for the runs inside the
 * window, not take the newest N from the list screen's capped query. With the
 * capped list, a tenant with more than 24 lifetime revaluations saw every older
 * period report as `revaluations: []` while the ledger held those runs.
 */
const run = (date: string): FxRevaluationRun => ({
  id: `run-${date}`,
  revaluationDate: date,
  status: "posted",
  functionalCurrency: "PKR",
  totalUnrealized: "1000.00",
  entryId: "je-1",
  reversalEntryId: "je-2",
  lines: [],
});

describe("buildFxReport", () => {
  it("queries the runs inside the period instead of a capped lifetime list", async () => {
    const listRunsBetween = vi.fn(async (_tenant: string, _from: string, _to: string) => [
      run("2024-06-30"),
      run("2024-12-31"),
    ]);
    const deps = {
      fx: {
        getCurrencySettings: vi.fn().mockResolvedValue({ functionalCurrency: "PKR" }),
      },
      listBalances: vi.fn().mockResolvedValue([]),
      listRunsBetween,
      listRealized: vi.fn().mockResolvedValue([]),
    } as unknown as FxReportDeps;

    const report = await buildFxReport(deps, "demo", {
      from: "2024-01-01",
      asOf: "2024-12-31",
    });

    expect(listRunsBetween).toHaveBeenCalledWith("demo", "2024-01-01", "2024-12-31");
    expect(report.revaluations).toEqual([
      { revaluationDate: "2024-06-30", totalUnrealized: "1000.00" },
      { revaluationDate: "2024-12-31", totalUnrealized: "1000.00" },
    ]);
  });
});
