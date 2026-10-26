import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FxReportPanel } from "./FxReportPanel";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useFxRevaluation", () => ({
  useFxReport: () => ({
    data: {
      from: "2026-11-01",
      asOf: "2026-11-30",
      functionalCurrency: "PKR",
      exposure: [
        {
          currency: "EUR",
          openTxn: "50.00",
          carryingFunc: "15000.00",
          closingRate: null,
          revaluedFunc: null,
          unrealized: null,
        },
        {
          currency: "USD",
          openTxn: "600.00",
          carryingFunc: "166800.00",
          closingRate: "283",
          revaluedFunc: "169800.00",
          unrealized: "3000.00",
        },
      ],
      realized: [{ currency: "USD", realized: "2000.00", payments: 1 }],
      totalRealized: "2000.00",
      revaluations: [],
    },
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("FxReportPanel", () => {
  it("given exposure in two currencies, should value USD at its closing rate and flag EUR as unrated", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<FxReportPanel dateFrom="2026-11-01" dateTo="2026-11-30" />);

    // Assert
    expect(html).toContain("283");
    expect(html).toContain("accounting.reports.fx.noRate");
    expect(html).toContain("accounting.reports.fx.realizedTitle");
    expect(html).toContain("accounting.reports.fx.noRevaluations");
  });
});
