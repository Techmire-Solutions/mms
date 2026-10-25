/**
 * IAS 21.39 translation of a member workspace's trial balance into the group's
 * presentation currency, and IFRS 10 aggregation of members into a consolidated
 * trial balance with intercompany elimination, cumulative translation
 * adjustment (CTA, in OCI) and non-controlling interest.
 */
import { convertMoney } from "../money/fxConvert.js";
import { currencyMinorUnits } from "../money/iso4217.js";
import { moneyToDecimalString, parseMoney, type Money } from "../money/money.js";

/** A member's trial-balance row in its functional currency (debit-positive balance). */
export interface MemberTrialBalanceRow {
  code: string;
  name: string;
  type: string;
  balance: number;
}

/** Rates translating one member's functional currency into the presentation currency. */
export interface TranslationRates {
  /** Assets and liabilities (IAS 21.39(a)). */
  closing: string;
  /** Income and expenses (IAS 21.39(b); an average approximates transaction-date rates). */
  average: string;
  /** Equity at historical rates; per account code, falling back to `defaultHistorical`. */
  historicalByCode?: Readonly<Record<string, string>>;
  defaultHistorical: string;
}

export interface TranslatedRow {
  code: string;
  name: string;
  type: string;
  functionalBalance: number;
  rate: string;
  /** Debit-positive balance in the presentation currency. */
  balance: number;
}

export interface TranslatedMember {
  memberSubdomain: string;
  functionalCurrency: string;
  rows: TranslatedRow[];
  /** Plug that makes the translated TB balance; credit-positive values are gains (OCI). */
  cta: number;
}

const toMoney = (amount: number, currency: string): Money =>
  parseMoney(amount.toFixed(currencyMinorUnits(currency)), currency);

const toNumber = (money: Money): number => Number(moneyToDecimalString(money));

function rateFor(row: MemberTrialBalanceRow, rates: TranslationRates): string {
  if (row.type === "Asset" || row.type === "Liability") return rates.closing;
  if (row.type === "Revenue" || row.type === "Expense") return rates.average;
  return rates.historicalByCode?.[row.code] ?? rates.defaultHistorical;
}

/**
 * Translate every row at its IAS 21 rate. The rows no longer balance (assets at
 * closing, equity at historical, results at average); the difference is the
 * period's CTA, returned separately so it lands in OCI, never in profit or loss.
 */
export function translateTrialBalance(
  memberSubdomain: string,
  rows: readonly MemberTrialBalanceRow[],
  rates: TranslationRates,
  functionalCurrency: string,
  presentationCurrency: string,
): TranslatedMember {
  let net = 0n;
  const translated = rows.map((row) => {
    const rate = functionalCurrency === presentationCurrency ? "1" : rateFor(row, rates);
    const money = convertMoney(
      toMoney(row.balance, functionalCurrency),
      rate,
      presentationCurrency,
    );
    net += money.minor;
    return { ...row, functionalBalance: row.balance, rate, balance: toNumber(money) };
  });
  return {
    memberSubdomain,
    functionalCurrency,
    rows: translated,
    // Debit-positive rows sum to `net`; a credit of the same amount balances them.
    cta: toNumber({ minor: net, currency: presentationCurrency }),
  };
}

export interface ConsolidationMemberInput {
  translated: TranslatedMember;
  /** Parent's ownership of this member, 0–100 (the parent itself is 100). */
  ownershipPercent: number;
}

export interface ConsolidatedRow {
  code: string;
  name: string;
  type: string;
  /** Sum of members' translated balances. */
  combined: number;
  /** Intercompany elimination (negates the combined balance on eliminated codes). */
  elimination: number;
  balance: number;
}

export interface ConsolidatedTrialBalance {
  presentationCurrency: string;
  rows: ConsolidatedRow[];
  /** Cumulative translation adjustment in OCI, plus FX left over from eliminations. */
  cta: number;
  /** Equity attributable to non-controlling interests (credit-positive). */
  nonControllingInterest: number;
  totals: { debit: number; credit: number };
}

/**
 * Aggregate translated members by account code (members share the group chart),
 * eliminate intercompany codes to zero (any residual from different translation
 * rates joins CTA), and measure non-controlling interest on each partly owned
 * member's translated net assets. The consolidated TB balances by construction.
 */
export function consolidateTrialBalances(
  members: readonly ConsolidationMemberInput[],
  intercompanyCodes: readonly string[],
  presentationCurrency: string,
): ConsolidatedTrialBalance {
  const byCode = new Map<string, ConsolidatedRow>();
  let ctaMinor = 0n;
  let nciMinor = 0n;
  const minor = (value: number) => toMoney(value, presentationCurrency).minor;
  for (const { translated, ownershipPercent } of members) {
    ctaMinor += minor(translated.cta);
    let netAssets = 0n;
    for (const row of translated.rows) {
      const existing = byCode.get(row.code) ?? {
        code: row.code,
        name: row.name,
        type: row.type,
        combined: 0,
        elimination: 0,
        balance: 0,
      };
      existing.combined = toNumber({
        minor: minor(existing.combined) + minor(row.balance),
        currency: presentationCurrency,
      });
      byCode.set(row.code, existing);
      if (row.type === "Asset" || row.type === "Liability") netAssets += minor(row.balance);
    }
    const outsideShare = BigInt(Math.round((100 - ownershipPercent) * 10_000));
    nciMinor += (netAssets * outsideShare) / 1_000_000n;
  }
  const eliminated = new Set(intercompanyCodes);
  let eliminationResidual = 0n;
  const rows = [...byCode.values()]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((row) => {
      const elimination = eliminated.has(row.code) ? -row.combined : 0;
      eliminationResidual += minor(elimination);
      return { ...row, elimination, balance: row.combined + elimination };
    });
  // Eliminating both sides of an intercompany balance leaves only the FX
  // difference from translating each side at its own member's rates.
  ctaMinor += eliminationResidual;
  let debit = 0n;
  let credit = 0n;
  for (const row of rows) {
    const value = minor(row.balance);
    if (value > 0n) debit += value;
    else credit -= value;
  }
  if (ctaMinor > 0n) credit += ctaMinor;
  else debit -= ctaMinor;
  const asNumber = (value: bigint) => toNumber({ minor: value, currency: presentationCurrency });
  return {
    presentationCurrency,
    rows,
    cta: asNumber(ctaMinor),
    nonControllingInterest: asNumber(nciMinor),
    totals: { debit: asNumber(debit), credit: asNumber(credit) },
  };
}

/** Synthetic equity row for results before the period that were never closed to retained earnings. */
export const PRIOR_UNCLOSED_RESULTS_CODE = "__prior_results";

/**
 * A member's trial balance for consolidation: cumulative balance-sheet rows as
 * of the period end plus the period's income and expense rows. Results from
 * earlier, unclosed periods sit only in the cumulative equity total, so they
 * are added as one equity row (translated at the historical rate) that makes
 * the member TB balance.
 */
export function buildMemberTrialBalance(
  balanceSheetRows: readonly MemberTrialBalanceRow[],
  periodResultRows: readonly MemberTrialBalanceRow[],
  functionalCurrency: string,
): MemberTrialBalanceRow[] {
  const rows = [
    ...balanceSheetRows.filter(
      (row) => row.type === "Asset" || row.type === "Liability" || row.type === "Equity",
    ),
    ...periodResultRows.filter((row) => row.type === "Revenue" || row.type === "Expense"),
  ].filter((row) => row.balance !== 0);
  const residual = rows.reduce(
    (sum, row) => sum + toMoney(row.balance, functionalCurrency).minor,
    0n,
  );
  if (residual === 0n) return rows;
  return [
    ...rows,
    {
      code: PRIOR_UNCLOSED_RESULTS_CODE,
      name: "Prior-period results (unclosed)",
      type: "Equity",
      balance: toNumber({ minor: -residual, currency: functionalCurrency }),
    },
  ];
}
