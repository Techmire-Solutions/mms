import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountingSettingsPreferences } from "./AccountingSettingsPreferences";
import { DEFAULT_ACCOUNTING_SETTINGS, type Account, type FiscalYear } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingFx", () => ({
  useAccountingCurrencySettings: () => ({
    data: { functionalCurrency: "PKR", enabledCurrencies: ["USD"] },
  }),
  useCurrencyExchangeability: () => ({
    data: [],
  }),
  useSaveCurrencyExchangeability: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingFxSettingsDraft", () => ({
  useAccountingFxSettingsDraft: () => ({
    draft: {
      functionalCurrency: "PKR",
      presentationCurrency: "PKR",
      enabledCurrencies: ["USD"],
    },
    currencyCodes: ["PKR", "USD"],
    dirty: false,
    saving: false,
    handleSave: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/accounting/hooks/useHyperinflationPanel", () => ({
  useHyperinflationPanel: () => ({
    settings: { enabled: false, netMonetaryAccountId: null, appliesFrom: null, indexName: "" },
    settingsError: false,
    refetchSettings: vi.fn(),
    settingsDirty: false,
    savingSettings: false,
    update: vi.fn(),
    handleSaveSettings: vi.fn(),
  }),
}));

const accounts: Account[] = [
  { id: "acc-1", code: "1000", name: "Cash", type: "Asset", isActive: true },
] as Account[];

const fiscalYears: FiscalYear[] = [
  {
    id: "fy-1",
    label: "FY 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
  },
] as FiscalYear[];

describe("AccountingSettingsPreferences", () => {
  it("renders setup configuration sections and does NOT render moved day-to-day sections", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <AccountingSettingsPreferences
          accounts={accounts}
          fiscalYears={fiscalYears}
          settingsDraft={DEFAULT_ACCOUNTING_SETTINGS}
          upd={vi.fn()}
          currencies={[{ code: "PKR", symbol: "₨", name: "Pakistani Rupee" }]}
          activeCurrency={{ code: "PKR", symbol: "₨", name: "Pakistani Rupee" }}
          decimalSeparators={[{ label: "Period (.)", value: "period" }]}
          fyStatusConfig={{}}
          canEditSetup={true}
          onEditFiscalYear={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Kept setup sections
    expect(html).toContain("accounting.settings.secCurrency");
    expect(html).toContain("accounting.settings.secIas29");
    expect(html).toContain("accounting.settings.secFiscalYears");
    expect(html).toContain("accounting.settings.secRules");
    expect(html).toContain("accounting.templates.title");
    expect(html).toContain("accounting.settings.secNumbering");
    expect(html).toContain("accounting.settings.secPosting");

    // Moved day-to-day sections must NOT be in Setup Preferences
    expect(html).not.toContain("accounting.settings.secFxReval");
    expect(html).not.toContain("accounting.settings.secHedges");
    expect(html).not.toContain("accounting.settings.secOpening");
    expect(html).not.toContain("accounting.settings.secBankRec");
  });
});
