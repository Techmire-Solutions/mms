import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SimpleTransactionAccountLegs } from "./SimpleTransactionAccountLegs";

vi.mock("@mms/fe-core/query/optionalQueryContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuthOrNull: () => ({ isAuthenticated: true, user: { id: "u-1" }, token: "test-token" }),
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("SimpleTransactionAccountLegs", () => {
  const form = {
    date: "",
    amount: "",
    debitAcc: "",
    creditAcc: "",
    description: "",
    ref: "",
    receipt: "",
    tags: [] as string[],
    fiscal_year: "",
  };

  it("shows account Plus when canAddAccount is enabled", () => {
    const html = renderToStaticMarkup(
      <SimpleTransactionAccountLegs
        prefix="wiz"
        leg1={{
          id: "wiz-debit",
          label: "Debit",
          field: "debitAcc",
          options: [{ value: "a1", label: "Cash" }],
        }}
        leg2={{
          id: "wiz-credit",
          label: "Credit",
          field: "creditAcc",
          options: [{ value: "a2", label: "Income" }],
        }}
        form={form}
        onAccountChange={vi.fn()}
        canAddAccount
        onOpenAddAccount={vi.fn()}
        showLowBalanceWarning={false}
        isSameAccount={false}
      />,
    );
    expect(html).toContain('aria-label="accounting.coa.addAccount"');
  });
});
