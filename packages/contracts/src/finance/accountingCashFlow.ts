import type { AccountingAccountType } from "./accountingEnums.js";

/**
 * Cash-flow statement classification (IAS 7 shape): operating, investing or
 * financing. An explicit per-account mapping always wins; otherwise the section
 * is inferred from the account's type/subtype so legacy charts still classify
 * without a migration of every account.
 */
export const CASH_FLOW_SECTIONS = ["operating", "investing", "financing"] as const;
export type CashFlowSection = (typeof CASH_FLOW_SECTIONS)[number];

export function isCashFlowSection(value: string): value is CashFlowSection {
  return (CASH_FLOW_SECTIONS as readonly string[]).includes(value);
}

/** Section a cash movement belongs to, from its non-cash counterpart account. */
export function cashFlowSectionForAccount(input: {
  type: AccountingAccountType | string;
  subtype?: string | null;
  cashFlowSection?: CashFlowSection | null;
}): CashFlowSection {
  if (input.cashFlowSection && isCashFlowSection(input.cashFlowSection)) {
    return input.cashFlowSection;
  }
  if (input.type === "Revenue" || input.type === "Expense") return "operating";
  if (input.type === "Equity") return "financing";
  if (input.type === "Liability") {
    return input.subtype === "Long-Term Liabilities" ? "financing" : "operating";
  }
  if (input.type === "Asset") {
    return input.subtype === "Fixed Assets" ? "investing" : "operating";
  }
  return "operating";
}
