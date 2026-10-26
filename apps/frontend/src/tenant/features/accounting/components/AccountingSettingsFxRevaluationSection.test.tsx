import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingSettingsFxRevaluationSection } from "./AccountingSettingsFxRevaluationSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const previewRun = {
  id: "preview",
  revaluationDate: "2026-11-30",
  status: "preview" as const,
  functionalCurrency: "PKR",
  totalUnrealized: "3000.00",
  entryId: null,
  reversalEntryId: null,
  lines: [
    {
      accountId: "ar",
      accountCode: "1100",
      accountName: "Fee Receivable",
      currency: "USD",
      openTxn: "1000.00",
      closingRate: "283",
      carryingFunc: "280000.00",
      revaluedFunc: "283000.00",
      unrealized: "3000.00",
    },
  ],
};

const panelState = vi.hoisted(() => ({ alreadyPosted: false }));

vi.mock("@/tenant/features/accounting/hooks/useFxRevaluationPanel", () => ({
  useFxRevaluationPanel: () => ({
    revaluationDate: "2026-11-30",
    setRevaluationDate: vi.fn(),
    previewRun,
    runs: [],
    runsLoading: false,
    runsError: false,
    refetchRuns: vi.fn(),
    alreadyPosted: panelState.alreadyPosted,
    previewing: false,
    posting: false,
    handlePreview: vi.fn(),
    handlePost: vi.fn(),
  }),
}));

describe("AccountingSettingsFxRevaluationSection", () => {
  it("given a preview, should list the monetary balance with its closing rate and offer to post", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<AccountingSettingsFxRevaluationSection canEditSetup />);

    // Assert
    expect(html).toContain("1100 – Fee Receivable");
    expect(html).toContain("283");
    expect(html).toContain("accounting.settings.fxReval.post");
  });

  it("given a date that is already revalued, should not offer a second posting", () => {
    // Arrange
    panelState.alreadyPosted = true;

    // Act
    const html = renderToStaticMarkup(<AccountingSettingsFxRevaluationSection canEditSetup />);

    // Assert
    expect(html).toContain("accounting.settings.fxReval.alreadyPosted");
    panelState.alreadyPosted = false;
  });
});
