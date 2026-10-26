import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingIas29Panel } from "./AccountingIas29Panel";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const run = {
  id: "ias29-1",
  restatementDate: "2026-12-31",
  status: "posted" as const,
  closingIndex: "150",
  netMonetaryResult: "-200.00",
  entryId: "je-1",
  reversalEntryId: "je-2",
  lines: [],
};

const settingsState = vi.hoisted(() => ({ enabled: true }));

vi.mock("@/tenant/features/accounting/hooks/useHyperinflation", () => ({
  useHyperinflationSettings: () => ({
    data: {
      enabled: settingsState.enabled,
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
  useIas29Runs: () => ({ data: [run], isPending: false }),
  usePreviewIas29: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePostIas29: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("AccountingIas29Panel", () => {
  it("given hyperinflation enabled and canEdit=true, should show index points and add action", () => {
    settingsState.enabled = true;
    const html = renderToStaticMarkup(<AccountingIas29Panel canEdit />);

    expect(html).toContain("accounting.settings.ias29.indexTitle");
    expect(html).toContain("150");
    expect(html).toContain("accounting.settings.ias29.addIndex");
  });

  it("given canEdit=false, should hide add index action", () => {
    settingsState.enabled = true;
    const html = renderToStaticMarkup(<AccountingIas29Panel canEdit={false} />);

    expect(html).not.toContain("accounting.settings.ias29.addIndex");
  });

  it("given hyperinflation disabled, should render nothing", () => {
    settingsState.enabled = false;
    const html = renderToStaticMarkup(<AccountingIas29Panel canEdit />);

    expect(html).toBe("");
  });
});
