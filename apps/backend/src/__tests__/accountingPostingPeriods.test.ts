import { describe, expect, it } from "vitest";
import { generatePostingPeriods } from "../db/repositories/accountingFiscalYearsRepository.js";

describe("accounting posting periods", () => {
  it("generates an open July 2026 period with inclusive ISO boundaries", () => {
    const periods = generatePostingPeriods({
      id: "fy-2026-2027",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      status: "active",
    });

    expect(periods).toHaveLength(12);
    expect(periods[0]).toEqual({
      id: "fy-2026-2027-2026-07",
      fiscalYearId: "fy-2026-2027",
      label: "2026-07",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      status: "open",
    });
    expect(periods.at(-1)?.endDate).toBe("2027-06-30");
  });

  it("marks generated periods closed when the fiscal year is closed", () => {
    const periods = generatePostingPeriods({
      id: "fy-closed",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      status: "closed",
    });
    expect(periods[0]?.status).toBe("closed");
  });
});
