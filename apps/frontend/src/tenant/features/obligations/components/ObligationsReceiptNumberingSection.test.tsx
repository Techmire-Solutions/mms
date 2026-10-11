import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ObligationsReceiptNumberingSection } from "./ObligationsReceiptNumberingSection";

describe("ObligationsReceiptNumberingSection Component", () => {
  it("renders receipt sequence numbering card with live preview and default values", () => {
    const html = renderToStaticMarkup(<ObligationsReceiptNumberingSection />);

    expect(html).toContain("obligations.receiptNumbering.title");
    expect(html).toContain("common.sequenceNumbering.autoGenerate");
    expect(html).toContain("common.sequenceNumbering.preview");
    expect(html).toContain("common.sequenceNumbering.lastIssued");
    expect(html).toContain("OBL-");
    expect(html).toContain("common.save");
  });
});
