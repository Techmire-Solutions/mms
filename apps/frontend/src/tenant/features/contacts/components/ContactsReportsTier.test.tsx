import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsReportsTier } from "./ContactsReportsTier";

vi.mock("@/tenant/components/moduleReports", () => ({
  KPISummary: ({ category }: { category: string }) => (
    <div data-testid="kpi-summary">KPI: {category}</div>
  ),
  ModuleReports: ({ category }: { category: string }) => (
    <div data-testid="module-reports">Reports: {category}</div>
  ),
}));

describe("ContactsReportsTier Component", () => {
  it("renders KPI summary and module reports for contacts", () => {
    const html = renderToStaticMarkup(<ContactsReportsTier />);

    expect(html).toContain("KPI: contacts");
    expect(html).toContain("Reports: contacts");
  });
});
