import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsolidationReport } from "@mms/shared";
import { exportConsolidationReportCsv } from "@/platform/features/consolidation/lib/exportConsolidationReportCsv";

const triggerDownload = vi.fn();

vi.mock("@/lib/download", () => ({
  triggerFileDownload: (...args: unknown[]) => triggerDownload(...args),
}));

const report: ConsolidationReport = {
  group: {
    id: "g1",
    name: "Holdings",
    presentationCurrency: "USD",
    members: [],
    intercompanyAccountCodes: [],
  },
  dateFrom: "2026-01-01",
  dateTo: "2026-01-31",
  members: [],
  consolidated: {
    presentationCurrency: "USD",
    rows: [{ code: "1000", name: "Cash", type: "asset", combined: 10, elimination: 0, balance: 10 }],
    cta: 0,
    nonControllingInterest: 0,
    totals: { debit: 10, credit: 10 },
  },
};

describe("exportConsolidationReportCsv", () => {
  beforeEach(() => triggerDownload.mockReset());

  it("downloads the consolidated rows as CSV", () => {
    exportConsolidationReportCsv(report);
    expect(triggerDownload).toHaveBeenCalledTimes(1);
    const blob = triggerDownload.mock.calls[0]?.[0] as Blob;
    return blob.text().then((csv) => {
      expect(csv).toContain("Cash");
      expect(csv).toContain("1000");
      expect(csv.split("\n")).toHaveLength(2);
    });
  });
});
