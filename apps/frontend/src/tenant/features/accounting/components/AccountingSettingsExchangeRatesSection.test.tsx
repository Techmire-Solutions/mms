import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingSettingsExchangeRatesSection } from "./AccountingSettingsExchangeRatesSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useExchangeRateDraft", () => ({
  useExchangeRateDraft: () => ({
    draft: {
      fromCurrency: "USD",
      toCurrency: "PKR",
      rateDate: "2026-10-26",
      rateType: "spot",
      rate: "280",
      overrideReason: "",
    },
    setDraft: vi.fn(),
    overriding: false,
    rates: [],
    isLoading: false,
    isError: false,
    saving: false,
    handleSave: vi.fn(),
    refetch: vi.fn(),
    error: null,
  }),
}));

describe("AccountingSettingsExchangeRatesSection", () => {
  it("given canEdit=true, should show the add rate button", () => {
    const html = renderToStaticMarkup(
      <AccountingSettingsExchangeRatesSection
        functionalCurrency="PKR"
        enabledCurrencies={["USD"]}
        canEdit
      />,
    );

    expect(html).toContain("accounting.settings.fx.rates.add");
  });

  it("given canEdit=false, should hide the add rate button", () => {
    const html = renderToStaticMarkup(
      <AccountingSettingsExchangeRatesSection
        functionalCurrency="PKR"
        enabledCurrencies={["USD"]}
        canEdit={false}
      />,
    );

    expect(html).not.toContain("accounting.settings.fx.rates.add");
  });
});
