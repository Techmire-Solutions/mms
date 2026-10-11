import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinanceReportsTier } from "./FinanceReportsTier";

vi.mock("@/tenant/components/moduleReports", () => ({
  KPISummary: ({ category }: { category: string }) => (
    <div data-testid="kpi-summary">KPI: {category}</div>
  ),
  ModuleReports: ({ category }: { category: string }) => (
    <div data-testid="module-reports">Reports: {category}</div>
  ),
}));

vi.mock("@/components/ui/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("FinanceReportsTier Component", () => {
  it("renders KPI summary and module reports for finance", () => {
    const html = renderToStaticMarkup(<FinanceReportsTier />);

    expect(html).toContain("KPI: finance");
    expect(html).toContain("Reports: finance");
  });
});
