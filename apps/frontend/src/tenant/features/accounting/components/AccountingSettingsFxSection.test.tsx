import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingSettingsFxSection } from "./AccountingSettingsFxSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingFx", () => ({
  useAccountingCurrencySettings: () => ({
    data: {
      functionalCurrency: "PKR",
      presentationCurrency: "PKR",
      locked: true,
      enabledCurrencies: ["USD"],
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSaveAccountingCurrencySettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAccountingExchangeRates: () => ({
    data: [
      {
        id: "r1",
        fromCurrency: "USD",
        toCurrency: "PKR",
        rateDate: "2026-10-01",
        rateType: "SPOT",
        rate: "280.5",
        source: "manual",
        overrideReason: "",
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSaveAccountingExchangeRates: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("AccountingSettingsFxSection", () => {
  it("given posted entries, should lock the functional currency and explain why", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<AccountingSettingsFxSection canEditSetup />);

    // Assert
    expect(html).toContain("accounting.settings.fx.functionalLockedHint");
    expect(html).toMatch(/id="accounting-functional-currency"[^>]*disabled/);
  });

  it("given stored rates, should list them as 1 source = rate target", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<AccountingSettingsFxSection canEditSetup />);

    // Assert
    expect(html).toContain("1 USD = 280.5 PKR");
  });

  it("given a view-only user, should hide the settings save footer", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<AccountingSettingsFxSection canEditSetup={false} />);

    // Assert
    expect(html).not.toContain("common.save");
  });
});
