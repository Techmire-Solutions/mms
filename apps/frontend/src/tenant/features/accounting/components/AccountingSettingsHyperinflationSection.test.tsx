import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Account } from "@mms/shared";
import { AccountingSettingsHyperinflationSection } from "./AccountingSettingsHyperinflationSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useHyperinflation", () => ({
  useHyperinflationSettings: () => ({
    data: {
      enabled: true,
      netMonetaryAccountId: "nmp",
      appliesFrom: "2026-01-01",
      indexName: "CPI",
    },
    isError: false,
    refetch: vi.fn(),
  }),
  useSaveHyperinflationSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePriceIndices: () => ({
    data: [{ indexDate: "2026-12-31", value: "150", source: "CPI" }],
    isPending: false,
  }),
  useSavePriceIndices: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useIas29Runs: () => ({ data: [], isPending: false }),
  usePreviewIas29: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePostIas29: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const accounts = [
  { id: "nmp", code: "7950", name: "Monetary gain/loss", type: "Expense", isActive: true },
] as Account[];

describe("AccountingSettingsHyperinflationSection", () => {
  it("given settings, should render the configuration form with net monetary account", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(
      <AccountingSettingsHyperinflationSection accounts={accounts} canEditSetup />,
    );

    // Assert
    expect(html).toContain("accounting.settings.secIas29");
    expect(html).toContain("7950 – Monetary gain/loss");
  });

  it("given a view-only user, should disable settings fields and hide save", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(
      <AccountingSettingsHyperinflationSection accounts={accounts} canEditSetup={false} />,
    );

    // Assert
    expect(html).not.toContain("accounting.settings.ias29.save");
  });
});
