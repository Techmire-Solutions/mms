import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleReportsTier } from "./ModuleReportsTier";

vi.mock("@/tenant/features/reports/components/KPISummary", () => ({
  default: ({ category }: { category: string }) => (
    <div data-testid="kpi-summary">KPI: {category}</div>
  ),
}));

vi.mock("@/tenant/features/reports/components/ModuleReports", () => ({
  default: ({ category }: { category: string }) => (
    <div data-testid="module-reports">Reports: {category}</div>
  ),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ModuleReportsTier Component", () => {
  it("renders KPI summary and module reports for the given category", () => {
    const html = renderToStaticMarkup(<ModuleReportsTier category="students" />);

    expect(html).toContain("KPI: students");
    expect(html).toContain("Reports: students");
  });
});
