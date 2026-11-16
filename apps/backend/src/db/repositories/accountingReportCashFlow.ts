import {
  cashFlowSectionForAccount,
  isDebitNormalAccountType,
  moneyToCents,
  type AccountingAccountType,
  type CashFlowSection,
  type LedgerPostingAccounts,
} from "@mms/shared";

export type { CashFlowSection } from "@mms/shared";

/** One account's movement for a specific report window. */
export interface ReportAccountRow {
  id: string;
  code: string;
  name: string;
  type: AccountingAccountType;
  subtype: string;
  totalDebitCents: number;
  totalCreditCents: number;
  /** Normal-side balance in integer cents (debit-normal type: debit − credit). */
  balanceCents: number;
  /** IAS 7 section (explicit mapping, else inferred from type/subtype). */
  cashFlowSection: CashFlowSection;
}

/** Cash/bank account classification for the cash-flow statement. */
const NON_CASH_ASSET_RE = /receiv|prepaid|accumulated|contra|deposit|advance/i;

/**
 * Cash/bank classification.
 *
 * Two rules compose, deliberately asymmetrically:
 *
 * - A configured `cashAccountId` is always cash, even when its code and name do
 *   not look like it. It is **additive** with the heuristic below, because a
 *   workspace may bank in several accounts while the posting rule holds only one,
 *   and gross cash flow should not under-report.
 * - Otherwise an Asset account is cash when its subtype/name says so, or when it
 *   sits in the conventional `10xx` block — minus the non-cash asset carve-outs
 *   above, which previously leaked receivables, prepaids and accumulated
 *   depreciation into cash flow.
 */
export function isCashAccount(
  row: { id: string; type: string; code: string; name: string; subtype: string },
  configuredCashAccountId?: string | null,
): boolean {
  if (configuredCashAccountId && row.id === configuredCashAccountId) return true;
  if (row.type !== "Asset") return false;
  const haystack = `${row.name} ${row.subtype}`.toLowerCase();
  if (NON_CASH_ASSET_RE.test(haystack)) return false;
  return row.code.startsWith("10") || haystack.includes("cash") || haystack.includes("bank");
}

/** Accounts-receivable accounts, used only when no AR account is configured. */
export function isReceivableAccount(row: { type: string; name: string; subtype: string }): boolean {
  return row.type === "Asset" && /receiv/i.test(`${row.name} ${row.subtype}`);
}

/** Current-liability payable accounts for the working-capital adjustment. */
export function isPayableAccount(row: { type: string; name: string; subtype: string }): boolean {
  return row.type === "Liability" && /payab/i.test(`${row.name} ${row.subtype}`);
}

/** Non-cash expense add-backs. */
export function isDepreciationAccount(row: {
  type: string;
  name: string;
  subtype: string;
}): boolean {
  return row.type === "Expense" && /depreciat|amorti/i.test(`${row.name} ${row.subtype}`);
}

/** Maps one account's raw debit/credit aggregate to a report row. */
export function toReportRow(
  raw: {
    id: string;
    code: string;
    name: string;
    type: string;
    subtype: string;
  },
  totalDebit: number,
  totalCredit: number,
): ReportAccountRow {
  const totalDebitCents = moneyToCents(totalDebit);
  const totalCreditCents = moneyToCents(totalCredit);
  const balanceCents = isDebitNormalAccountType(raw.type)
    ? totalDebitCents - totalCreditCents
    : totalCreditCents - totalDebitCents;
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    type: raw.type as AccountingAccountType,
    subtype: raw.subtype,
    totalDebitCents,
    totalCreditCents,
    balanceCents,
    cashFlowSection: cashFlowSectionForAccount({ type: raw.type, subtype: raw.subtype }),
  };
}

export interface CashEntryMovement {
  entryId: string;
  cashDebitCents: number;
  cashCreditCents: number;
}

export interface CashFlowSectionFigures {
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  /** Indirect-method subtotal for this section (partitions the total indirect). */
  indirectCents: number;
}

export interface CashFlowFigures {
  cashInflowCents: number;
  cashOutflowCents: number;
  netCashFlowCents: number;
  netCashFlowIndirectCents: number;
  adjustments: {
    depreciationCents: number;
    receivablesCents: number;
    payablesCents: number;
    otherCents: number;
  };
  sections: Record<CashFlowSection, CashFlowSectionFigures>;
}

/**
 * Cash-flow figures for a report window.
 *
 * Gross inflow/outflow are split **per entry**, not per account: an internal
 * transfer (bank → cash) debits one cash account and credits another, which used
 * to appear as both an inflow and an outflow. Splitting the entry's net cash leg
 * (`max(0, debit − credit)` / `max(0, credit − debit)`) removes the transfer from
 * both gross figures while leaving the net movement unchanged.
 *
 * The indirect total is derived from every non-cash account in the same window
 * (`flowRows`, closing journals already excluded):
 *
 *   indirect = netSurplus − Σ_{non-cash balance-sheet}(debit − credit)
 *
 * Because every posted entry balances, that identity equals the actual cash
 * movement by construction, whatever the ledger contains (prepaids, accruals,
 * inventory, contra-assets, owner equity). The named adjustments stay a display
 * breakdown; `other` is the residual that makes the lines sum to the total.
 */
/**
 * Classify one entry's net cash leg by the section of its non-cash counterpart
 * account(s). A single section wins; mixed counterparties fall back to operating
 * (conservative — a split entry is not a clean investing/financing event).
 */
function sectionForEntry(
  entryId: string,
  counterparties: ReadonlyMap<string, readonly string[]>,
  sectionById: ReadonlyMap<string, CashFlowSection>,
): CashFlowSection {
  const sections = new Set(
    (counterparties.get(entryId) ?? [])
      .map((accountId) => sectionById.get(accountId))
      .filter((section): section is CashFlowSection => section !== undefined),
  );
  return sections.size === 1 ? [...sections][0]! : "operating";
}

export function buildCashFlowFigures(
  flowRows: ReportAccountRow[],
  cashMovements: readonly CashEntryMovement[],
  netSurplusCents: number,
  postingRules: Partial<LedgerPostingAccounts>,
  sectionById: ReadonlyMap<string, CashFlowSection>,
  entryCounterparties: ReadonlyMap<string, readonly string[]>,
): CashFlowFigures {
  let cashInflowCents = 0;
  let cashOutflowCents = 0;
  const sectionCents: Record<CashFlowSection, CashFlowSectionFigures> = {
    operating: { inflowCents: 0, outflowCents: 0, netCents: 0, indirectCents: 0 },
    investing: { inflowCents: 0, outflowCents: 0, netCents: 0, indirectCents: 0 },
    financing: { inflowCents: 0, outflowCents: 0, netCents: 0, indirectCents: 0 },
  };
  for (const movement of cashMovements) {
    const net = movement.cashDebitCents - movement.cashCreditCents;
    cashInflowCents += Math.max(0, net);
    cashOutflowCents += Math.max(0, -net);
    const section = sectionForEntry(movement.entryId, entryCounterparties, sectionById);
    sectionCents[section].inflowCents += Math.max(0, net);
    sectionCents[section].outflowCents += Math.max(0, -net);
  }
  const netCashFlowCents = cashInflowCents - cashOutflowCents;

  const cashIds = new Set(
    flowRows.filter((row) => isCashAccount(row, postingRules.cashAccountId)).map((row) => row.id),
  );

  let indirectCents = netSurplusCents;
  let depreciationCents = 0;
  let receivableMovementCents = 0;
  let payableMovementCents = 0;
  // The operating section starts from P&L; investing/financing are pure balance-sheet
  // mirrors of their classified non-cash accounts.
  sectionCents.operating.indirectCents = netSurplusCents;

  for (const row of flowRows) {
    const flowDebitPos = row.totalDebitCents - row.totalCreditCents;
    const isBalanceSheet =
      row.type === "Asset" || row.type === "Liability" || row.type === "Equity";
    if (isBalanceSheet && !cashIds.has(row.id)) {
      // A non-cash balance-sheet increase consumes cash (asset) or releases it
      // (liability/equity); the indirect method adds `−movement`.
      const contribution = -flowDebitPos;
      indirectCents += contribution;
      sectionCents[row.cashFlowSection].indirectCents += contribution;
    }
    // A configured AR account is authoritative and EXCLUSIVE: unlike cash there is
    // exactly one receivable, so the name heuristic must not add further accounts.
    const isConfiguredAr = Boolean(postingRules.arAccountId) && row.id === postingRules.arAccountId;
    if (isConfiguredAr || (!postingRules.arAccountId && isReceivableAccount(row))) {
      receivableMovementCents += flowDebitPos;
    }
    if (isPayableAccount(row)) payableMovementCents += -flowDebitPos;
    if (isDepreciationAccount(row)) depreciationCents += flowDebitPos;
  }

  const receivablesCents = -receivableMovementCents;
  const payablesCents = payableMovementCents;
  // `other` is now the operating-only residual: the named operating lines
  // (netSurplus + depreciation + receivables + payables + other) sum to the
  // operating indirect subtotal.
  const namedCents = netSurplusCents + depreciationCents + receivablesCents + payablesCents;
  const otherCents = sectionCents.operating.indirectCents - namedCents;

  for (const section of Object.keys(sectionCents) as CashFlowSection[]) {
    sectionCents[section].netCents =
      sectionCents[section].inflowCents - sectionCents[section].outflowCents;
  }
  return {
    cashInflowCents,
    cashOutflowCents,
    netCashFlowCents,
    netCashFlowIndirectCents: indirectCents,
    sections: sectionCents,
    adjustments: { depreciationCents, receivablesCents, payablesCents, otherCents },
  };
}
