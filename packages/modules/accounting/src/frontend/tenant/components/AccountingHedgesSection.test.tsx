import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { HedgeRelationship } from "@mms/contracts";
import { AccountingHedgesSection } from "./AccountingHedgesSection";

vi.mock("@mms/fe-core/query/optionalQueryContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuthOrNull: () => ({ isAuthenticated: true, user: { id: "u-1" }, token: "test-token" }),
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../hooks/useAccountingFx", () => ({
  useAccountingCurrencySettings: () => ({ data: { enabledCurrencies: ["USD"] } }),
}));

const hedge = (status: HedgeRelationship["status"]): HedgeRelationship => ({
  id: `hedge-${status}`,
  name: `Hedge ${status}`,
  hedgeType: "cash_flow",
  direction: "buy",
  currency: "USD",
  notional: "1000",
  contractRate: "283",
  designationRate: "285",
  designationDate: "2026-10-01",
  maturityDate: "2027-01-31",
  hedgedItem: "Forecast purchase",
  riskManagementObjective: "Fix the PKR cost",
  instrumentAccountId: "deriv",
  reserveAccountId: "cfhr",
  pnlAccountId: "hpl",
  status,
  settledReserve: "0",
  valuations: [],
});

vi.mock("../hooks/useHedges", () => ({
  useHedges: () => ({
    data: [hedge("active"), hedge("settled")],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateHedge: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePostHedgeValuation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSettleHedge: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReclassifyHedge: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDiscontinueHedge: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("AccountingHedgesSection", () => {
  it("given an active and a settled cash flow hedge, should offer value/settle and reclassify respectively", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<AccountingHedgesSection accounts={[]} canEdit />);

    // Assert
    expect(html).toContain("Hedge active");
    expect(html).toContain("accounting.settings.hedges.value");
    expect(html).toContain("accounting.settings.hedges.settle");
    // IFRS 9.6.5.6: an active hedge can be discontinued, and a settled or
    // discontinued cash flow hedge can reclassify its reserve.
    expect(html).toContain("accounting.settings.hedges.discontinue");
    expect(html).toContain("accounting.settings.hedges.reclassify");
  });

  it("given a view-only user, should hide every hedge action", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(<AccountingHedgesSection accounts={[]} canEdit={false} />);

    // Assert
    expect(html).not.toContain("accounting.settings.hedges.designate");
    expect(html).not.toContain("accounting.settings.hedges.value");
  });
});
