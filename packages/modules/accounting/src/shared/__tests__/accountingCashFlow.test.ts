import { describe, expect, it } from "vitest";
import { CASH_FLOW_SECTIONS, cashFlowSectionForAccount, isCashFlowSection } from "@mms/contracts";

describe("cashFlowSectionForAccount", () => {
  it("lets an explicit mapping win over inference", () => {
    expect(cashFlowSectionForAccount({ type: "Revenue", cashFlowSection: "financing" })).toBe(
      "financing",
    );
  });

  it("infers revenue/expense and current accounts as operating", () => {
    expect(cashFlowSectionForAccount({ type: "Revenue" })).toBe("operating");
    expect(cashFlowSectionForAccount({ type: "Expense" })).toBe("operating");
    expect(cashFlowSectionForAccount({ type: "Asset", subtype: "Current Assets" })).toBe(
      "operating",
    );
    expect(cashFlowSectionForAccount({ type: "Liability", subtype: "Current Liabilities" })).toBe(
      "operating",
    );
  });

  it("infers fixed assets as investing and equity/long-term debt as financing", () => {
    expect(cashFlowSectionForAccount({ type: "Asset", subtype: "Fixed Assets" })).toBe("investing");
    expect(cashFlowSectionForAccount({ type: "Equity" })).toBe("financing");
    expect(cashFlowSectionForAccount({ type: "Liability", subtype: "Long-Term Liabilities" })).toBe(
      "financing",
    );
  });

  it("narrows the enum without guessing", () => {
    expect(CASH_FLOW_SECTIONS).toEqual(["operating", "investing", "financing"]);
    expect(isCashFlowSection("operating")).toBe(true);
    expect(isCashFlowSection("nonsense")).toBe(false);
  });
});
