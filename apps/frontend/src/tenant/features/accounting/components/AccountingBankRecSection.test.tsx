import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingBankRecSection } from "./AccountingBankRecSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingLedgerOps", () => ({
  useBankStatements: () => ({ data: [] }),
  useSaveBankStatement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMatchBankReconciliation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  parseMoneyInput: vi.fn(),
  hasAtMostTwoDecimals: vi.fn(),
}));

describe("AccountingBankRecSection", () => {
  it("given canEdit=true, should render add bank statement and match buttons", () => {
    const html = renderToStaticMarkup(
      <AccountingBankRecSection accounts={[]} decimalSeparator="period" canEdit />,
    );

    expect(html).toContain("accounting.settings.bankRec.add");
    expect(html).toContain("accounting.settings.bankRec.match");
  });

  it("given canEdit=false, should hide action buttons", () => {
    const html = renderToStaticMarkup(
      <AccountingBankRecSection accounts={[]} decimalSeparator="period" canEdit={false} />,
    );

    expect(html).not.toContain("accounting.settings.bankRec.add");
    expect(html).not.toContain("accounting.settings.bankRec.match");
  });
});
