import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingDashboardCharts } from "./AccountingDashboardCharts";

const language = vi.hoisted(() => ({ value: "en" }));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: language.value }),
}));

const props = {
  monthlyData: [
    { month: "2026-01", revenue: 10, expenses: 4 },
    { month: "2026-02", revenue: 12, expenses: 5 },
  ],
  expenseBreakdown: [
    { name: "Alpha", value: 4 },
    { name: "Beta", value: 2 },
    { name: "Gamma", value: 1 },
  ],
  primary: "#0ea5e9",
  secondary: "#f97316",
  pieColors: ["#0ea5e9", "#f97316", "#10b981"] as const,
  formatCurrency: (amount: number) => String(amount),
};

describe("AccountingDashboardCharts BiDi", () => {
  it("keeps the LTR legend order in English", () => {
    language.value = "en";
    const html = renderToStaticMarkup(<AccountingDashboardCharts {...props} />);
    expect(html.indexOf("Alpha")).toBeLessThan(html.indexOf("Gamma"));
  });

  it("mirrors the legend order for RTL locales", () => {
    language.value = "ar";
    const html = renderToStaticMarkup(<AccountingDashboardCharts {...props} />);
    expect(html.indexOf("Gamma")).toBeLessThan(html.indexOf("Alpha"));
  });

  it("always keeps the sr-only data table next to the bar chart", () => {
    language.value = "ur";
    const html = renderToStaticMarkup(<AccountingDashboardCharts {...props} />);
    expect(html).toContain("accounting.dashboard.revenueVsExpensesTable");
    expect(html).toContain("<table");
  });
});
