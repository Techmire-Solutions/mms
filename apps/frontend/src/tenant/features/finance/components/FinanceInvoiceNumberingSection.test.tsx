import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_FINANCE_SETTINGS } from "@mms/shared";
import { FinanceInvoiceNumberingSection } from "./FinanceInvoiceNumberingSection";

describe("FinanceInvoiceNumberingSection Component", () => {
  it("renders fee invoice sequence numbering card with live preview and default values", () => {
    const html = renderToStaticMarkup(
      <FinanceInvoiceNumberingSection settingsDraft={DEFAULT_FINANCE_SETTINGS} upd={vi.fn()} />,
    );

    expect(html).toContain("finance.invoiceNumbering.title");
    expect(html).toContain("common.sequenceNumbering.autoGenerate");
    expect(html).toContain("common.sequenceNumbering.preview");
    expect(html).toContain("common.sequenceNumbering.lastIssued");
    expect(html).toContain("INV-");
  });
});
