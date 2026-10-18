import type { AccountInsert } from "./accountingModuleManifest.js";

/** A seedable posting account: `subtype` carries the COA group, the 5-digit code carries the hierarchy. */
export type DefaultChartAccount = Required<
  Pick<AccountInsert, "code" | "name" | "type" | "subtype" | "description">
>;

/** Top-level COA sections: 5-digit code block → account type. */
export const DEFAULT_CHART_SECTIONS = [
  { from: 10000, to: 19999, label: "Assets", type: "Asset" },
  { from: 20000, to: 29999, label: "Liabilities", type: "Liability" },
  { from: 30000, to: 39999, label: "Equity", type: "Equity" },
  { from: 40000, to: 49999, label: "Revenue", type: "Revenue" },
  { from: 50000, to: 59999, label: "Cost of Sales", type: "Expense" },
  { from: 60000, to: 69999, label: "Operating Expenses", type: "Expense" },
  { from: 70000, to: 79999, label: "Other Income", type: "Revenue" },
  { from: 80000, to: 89999, label: "Other Expenses", type: "Expense" },
  { from: 90000, to: 99999, label: "Tax & Exceptional", type: "Expense" },
] as const satisfies ReadonlyArray<{
  from: number;
  to: number;
  label: string;
  type: AccountInsert["type"];
}>;

/** Seeded accounts used to fill workspace settings that are still unset when the chart is seeded. */
export const DEFAULT_CHART_RETAINED_EARNINGS_CODE = "33000";
export const DEFAULT_CHART_CASH_ACCOUNT_CODE = "10300";

type Row = readonly [code: string, name: string, description?: string];

const group = (
  type: AccountInsert["type"],
  subtype: string,
  rows: readonly Row[],
): DefaultChartAccount[] =>
  rows.map(([code, name, description = ""]) => ({ code, name, type, subtype, description }));

/**
 * Generic, jurisdiction-neutral business Chart of Accounts seeded into an empty
 * workspace. Only posting (leaf) accounts are seeded — the account model has no
 * parent/group columns, so groups live in `subtype` and the code block.
 *
 * The `10xxx` block is reserved for cash and bank accounts: the cash-flow
 * classifier treats any Asset code starting with `10` as cash.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: readonly DefaultChartAccount[] = [
  ...group("Asset", "Cash & Bank", [
    ["10100", "Cash", "Cash on hand"],
    ["10200", "Petty Cash"],
    ["10300", "Bank Accounts"],
  ]),
  ...group("Asset", "Current Assets", [
    ["11100", "Accounts Receivable"],
    ["11200", "Other Receivables"],
    ["11300", "Inventory"],
    ["11400", "Prepaid Expenses"],
  ]),
  ...group("Asset", "Fixed Assets", [
    ["15100", "Land"],
    ["15200", "Buildings"],
    ["15300", "Furniture & Fixtures"],
    ["15400", "Office Equipment"],
    ["15500", "Computer / IT Equipment"],
    ["15600", "Vehicles"],
    ["15900", "Accumulated Depreciation", "Contra-asset: carries a credit balance"],
  ]),
  ...group("Liability", "Current Liabilities", [
    ["21100", "Accounts Payable"],
    ["21200", "Accrued Expenses"],
    ["21300", "Salaries Payable"],
    ["21400", "Taxes Payable"],
    ["21500", "Customer Deposits"],
    ["21600", "Short-Term Loans"],
  ]),
  ...group("Liability", "Long-Term Liabilities", [
    ["25100", "Long-Term Loans"],
    ["25200", "Lease Liabilities"],
  ]),
  ...group("Equity", "Equity", [
    ["31000", "Owner's Capital / Share Capital"],
    ["32000", "Additional Paid-in Capital"],
    ["33000", "Retained Earnings"],
    ["34000", "Current Year Earnings"],
    ["35000", "Drawings / Dividends", "Contra-equity: carries a debit balance"],
  ]),
  ...group("Revenue", "Operating Revenue", [
    ["41000", "Sales Revenue"],
    ["42000", "Service Revenue"],
    ["43000", "Other Operating Revenue"],
    ["49000", "Discounts / Returns", "Contra-revenue: carries a debit balance"],
  ]),
  ...group("Expense", "Cost of Sales", [
    ["51000", "Cost of Goods Sold"],
    ["52000", "Direct Materials"],
    ["53000", "Direct Labor"],
    ["59000", "Other Direct Costs"],
  ]),
  ...group("Expense", "Operating Expenses", [
    ["60100", "Salaries & Wages"],
    ["60200", "Rent"],
    ["60300", "Utilities"],
    ["60400", "Telephone & Internet"],
    ["60500", "Office Expenses"],
    ["60600", "Repairs & Maintenance"],
    ["60700", "Insurance"],
    ["60800", "Marketing & Advertising"],
    ["60900", "Travel & Transportation"],
    ["61000", "Professional Fees"],
    ["61100", "Software & Subscriptions"],
    ["61200", "IT Expenses"],
    ["61300", "Depreciation Expense"],
    ["61400", "Bank Charges"],
    ["61500", "General & Administrative Expenses"],
  ]),
  ...group("Revenue", "Other Income", [
    ["71000", "Interest Income"],
    ["72000", "Foreign Exchange Gain"],
    ["73000", "Gain on Asset Disposal"],
    ["79000", "Other Non-operating Income"],
  ]),
  ...group("Expense", "Other Expenses", [
    ["81000", "Interest Expense"],
    ["82000", "Foreign Exchange Loss"],
    ["83000", "Loss on Asset Disposal"],
    ["89000", "Other Non-operating Expenses"],
  ]),
  ...group("Expense", "Tax & Exceptional", [
    ["91000", "Income Tax Expense"],
    ["92000", "Deferred Tax Expense"],
    [
      "99000",
      "Exceptional / Extraordinary Items",
      "Use only where the reporting framework permits",
    ],
  ]),
];
