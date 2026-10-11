import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UsersReportsTier } from "./UsersReportsTier";

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

describe("UsersReportsTier Component", () => {
  it("renders KPI summary and module reports for users", () => {
    const html = renderToStaticMarkup(<UsersReportsTier />);

    expect(html).toContain("KPI: users");
    expect(html).toContain("Reports: users");
  });
});
