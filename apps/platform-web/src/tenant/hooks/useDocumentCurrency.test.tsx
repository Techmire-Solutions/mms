import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useDocumentCurrency } from "./useDocumentCurrency";

const mocks = vi.hoisted(() => ({
  settingsData: undefined as
    { functionalCurrency: string; enabledCurrencies: string[] } | undefined,
  rateData: null as { rate: string } | null,
  rateIsSuccess: false,
}));

vi.mock("@/tenant/hooks/collections/accounting", () => ({
  useAccountingCurrencySettings: () => ({ data: mocks.settingsData }),
  useExchangeRateLookup: () => ({ data: mocks.rateData, isSuccess: mocks.rateIsSuccess }),
}));

function renderHook(props: {
  date: string;
  initialCurrency?: string | null;
  initialRate?: string | null;
}) {
  let result!: ReturnType<typeof useDocumentCurrency>;
  function Harness() {
    result = useDocumentCurrency({
      date: props.date,
      initialCurrency: props.initialCurrency,
      initialRate: props.initialRate,
    });
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  const rerender = (next: typeof props) =>
    act(() => {
      props = next;
      root.render(<Harness />);
    });
  act(() => {
    root.render(<Harness />);
  });
  return {
    current: () => result,
    rerender,
    unmount: () => act(() => root.unmount()),
  };
}

describe("useDocumentCurrency", () => {
  beforeEach(() => {
    mocks.settingsData = undefined;
    mocks.rateData = null;
    mocks.rateIsSuccess = false;
  });

  it("starts empty and re-seeds from the document once the functional currency loads", () => {
    const { current, rerender, unmount } = renderHook({
      date: "2026-11-22",
      initialCurrency: null,
      initialRate: null,
    });
    expect(current().functionalCurrency).toBe("");
    expect(current().currency).toBe("");

    mocks.settingsData = { functionalCurrency: "USD", enabledCurrencies: ["EUR", "GBP"] };
    rerender({ date: "2026-11-22", initialCurrency: "EUR", initialRate: "1.20" });

    // Regression: a document reopened for edit must seed its stored currency
    // and rate once the workspace's functional currency arrives, instead of
    // keeping the empty pre-load defaults.
    expect(current().currency).toBe("EUR");
    expect(current().rateOverride).toBe("1.20");
    expect(current().isForeign).toBe(true);
    expect(current().currencyOptions.map((o) => o.value)).toEqual(["USD", "EUR", "GBP"]);
    unmount();
  });

  it("preserves the user's manual edits while the seed inputs are unchanged", () => {
    mocks.settingsData = { functionalCurrency: "USD", enabledCurrencies: ["EUR"] };
    const { current, rerender, unmount } = renderHook({
      date: "2026-11-22",
      initialCurrency: "USD",
      initialRate: null,
    });
    expect(current().currency).toBe("USD");

    act(() => {
      current().setCurrency("EUR");
      current().setRateOverride("0.95");
    });
    expect(current().currency).toBe("EUR");
    expect(current().rateOverride).toBe("0.95");

    rerender({ date: "2026-11-22", initialCurrency: "USD", initialRate: null });
    expect(current().currency).toBe("EUR");
    expect(current().rateOverride).toBe("0.95");
    unmount();
  });

  it("re-seeds when the document identity changes to a new stored currency", () => {
    mocks.settingsData = { functionalCurrency: "USD", enabledCurrencies: ["EUR"] };
    const { current, rerender, unmount } = renderHook({
      date: "2026-11-22",
      initialCurrency: "USD",
      initialRate: null,
    });

    rerender({ date: "2026-11-22", initialCurrency: "EUR", initialRate: "0.90" });
    expect(current().currency).toBe("EUR");
    expect(current().rateOverride).toBe("0.90");
    unmount();
  });
});
