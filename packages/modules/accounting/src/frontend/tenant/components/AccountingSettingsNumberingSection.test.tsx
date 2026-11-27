vi.mock("@mms/fe-core/query/optionalQueryContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuthOrNull: () => ({ isAuthenticated: true, user: { id: "u-1" }, token: "test-token" }),
}));

vi.mock("../hooks/useVoucherNumbering", () => ({
  VOUCHER_NUMBERING_QUERY_KEY: ["accounting", "voucher-numbering"],
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

vi.mock("../index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../index")>();
  return {
    ...actual,
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
  };
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingSettingsNumberingSection } from "./AccountingSettingsNumberingSection";

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useTranslation: () => ({ t: (key: string) => key }),
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
