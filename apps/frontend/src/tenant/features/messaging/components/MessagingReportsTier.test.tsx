import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagingReportsTier } from "./MessagingReportsTier";

vi.mock("@/tenant/components/moduleReports", () => ({
  KPISummary: ({ category }: { category: string }) => (
    <div data-testid="kpi-summary">KPI: {category}</div>
  ),
  ModuleReports: ({ category }: { category: string }) => (
    <div data-testid="module-reports">Reports: {category}</div>
  ),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("MessagingReportsTier Component", () => {
  it("renders KPI summary and module reports for messaging", () => {
    const html = renderToStaticMarkup(<MessagingReportsTier />);

    expect(html).toContain("KPI: messaging");
    expect(html).toContain("Reports: messaging");
  });
});
