import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinancialLedgerTable } from "@/components/app/FinancialLedgerTable";

describe("FinancialLedgerTable", () => {
  it("renders table caption, column headers, and data rows", () => {
    const html = renderToStaticMarkup(
      <FinancialLedgerTable
        caption="Journal lines preview"
        rows={[
          { account: "Cash on Hand", debit: "1,500.00", variant: "debit" },
          { account: "Tuition Revenue", credit: "1,500.00", variant: "credit" },
        ]}
      />,
    );

    expect(html).toContain("Journal lines preview");
    expect(html).toContain("Account");
    expect(html).toContain("Debit");
    expect(html).toContain("Credit");
    expect(html).toContain("Cash on Hand");
    expect(html).toContain("Tuition Revenue");
    expect(html).toContain("row-debit");
    expect(html).toContain("row-credit");
    expect(html).toContain("1,500.00");
  });

  it("supports localized column header labels", () => {
    const html = renderToStaticMarkup(
      <FinancialLedgerTable
        caption="Custom labels"
        columnLabels={{
          account: "حساب",
          debit: "مدين",
          credit: "دائن",
        }}
        rows={[{ account: "البنك", debit: "100.00", variant: "debit" }]}
      />,
    );

    expect(html).toContain("حساب");
    expect(html).toContain("مدين");
    expect(html).toContain("دائن");
    expect(html).toContain("البنك");
  });

  it("renders em-dash placeholder when amounts are not provided", () => {
    const html = renderToStaticMarkup(
      <FinancialLedgerTable
        caption="Incomplete entry"
        rows={[{ account: "Suspense", variant: "neutral" }]}
      />,
    );

    expect(html).toContain("Suspense");
    expect(html).toContain("—");
  });
});
