import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingSettingsNumberingSection } from "./AccountingSettingsNumberingSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useVoucherNumbering", () => ({
  useVoucherNumbering: () => ({
    data: {
      autoGenerate: true,
      prefix: "JV",
      delimiter: "/",
      yearFormat: "NONE",
      sequenceDigits: 4,
      startingSequence: 1,
      rolloverPolicy: "never",
      currentSequence: 41,
      periodYear: 0,
      nextVoucherNumber: "JV/0042",
    },
  }),
  useSaveVoucherNumbering: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("AccountingSettingsNumberingSection", () => {
  it("renders the stored server numbering in the shared sequence card", () => {
    const html = renderToStaticMarkup(<AccountingSettingsNumberingSection canEdit />);

    expect(html).toContain("accounting.settings.secVoucher");
    expect(html).toContain("accounting.settings.voucher.autoGenerate");
    expect(html).toContain("{PREFIX}/{SEQ}");
    expect(html).toContain("JV/0042");
    expect(html).toContain("common.save");
  });

  it("hides Save for view-only users", () => {
    const html = renderToStaticMarkup(<AccountingSettingsNumberingSection canEdit={false} />);
    expect(html).not.toContain("common.save");
  });
});
