import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingBankingPanel } from "./AccountingBankingPanel";

vi.mock("@mms/fe-core/query/optionalQueryContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuthOrNull: () => ({ isAuthenticated: true, user: { id: "u-1" }, token: "test-token" }),
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../hooks/useAccountingLedgerOps", () => ({
  useBankStatements: () => ({ data: [] }),
  useSaveBankStatement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMatchBankReconciliation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  parseMoneyInput: vi.fn(),
  hasAtMostTwoDecimals: vi.fn(),
}));

describe("AccountingBankingPanel", () => {
  it("given canWrite=true, should render bank rec add and match actions", () => {
    const html = renderToStaticMarkup(
      <AccountingBankingPanel accounts={[]} decimalSeparator="period" canWrite />,
    );

    expect(html).toContain("accounting.settings.secBankRec");
    expect(html).toContain("accounting.settings.bankRec.add");
    expect(html).toContain("accounting.settings.bankRec.match");
  });

  it("given canWrite=false, should hide bank rec add and match actions", () => {
    const html = renderToStaticMarkup(
      <AccountingBankingPanel accounts={[]} decimalSeparator="period" canWrite={false} />,
    );

    expect(html).toContain("accounting.settings.secBankRec");
    expect(html).not.toContain("accounting.settings.bankRec.add");
    expect(html).not.toContain("accounting.settings.bankRec.match");
  });
});
