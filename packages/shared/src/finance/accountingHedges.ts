/**
 * IFRS 9 hedge accounting for FX forwards. The forward is measured at fair
 * value: notional × (market rate − contract rate), positive for a bought
 * forward when the foreign currency strengthens. In a cash flow hedge the
 * effective part — the lower of the cumulative instrument change and the
 * cumulative change in the hedged cash flows (IFRS 9.6.5.11), the latter
 * measured as a hypothetical derivative at the market forward rate on the
 * designation date (IFRS 9.B6.5.5) — goes to the
 * cash flow hedge reserve in OCI and the rest to profit or loss; in a fair
 * value hedge the whole change goes to profit or loss (the hedged monetary
 * item is remeasured by the IAS 21 revaluation).
 */
import { convertMoney } from "../money/fxConvert.js";
import { moneyToDecimalString, parseMoney, subtractMoney, type Money } from "../money/money.js";
import { normalizeStoredAmount } from "./accountingFxRevaluation.js";
import type { JournalLine } from "./accountingModuleManifest.js";
import type { HedgeRelationship } from "./accountingHedgeSchemas.js";

export interface HedgeValuation {
  rate: string;
  /** Cumulative fair value of the forward, functional currency. */
  instrumentValue: string;
  /** Cumulative change in the hedged cash flows (cash flow hedges), functional currency. */
  hedgedChange: string;
  /** Portion recognised in the cash flow hedge reserve (OCI). */
  effective: string;
  /** Portion recognised in profit or loss. */
  ineffective: string;
}

type Terms = Pick<
  HedgeRelationship,
  "hedgeType" | "direction" | "currency" | "notional" | "contractRate" | "designationRate"
>;

const absolute = (value: bigint) => (value < 0n ? -value : value);

/** Fair value, hedged-item change and the OCI / P&L split at `rate`. */
export function computeHedgeValuation(
  terms: Terms,
  rate: string,
  functionalCurrency: string,
): HedgeValuation {
  const notional = parseMoney(
    normalizeStoredAmount(terms.notional, terms.currency),
    terms.currency,
  );
  const at = (value: string): Money => convertMoney(notional, value, functionalCurrency);
  const sign = terms.direction === "buy" ? 1n : -1n;
  const instrument = sign * subtractMoney(at(rate), at(terms.contractRate)).minor;
  const hypothetical = sign * subtractMoney(at(rate), at(terms.designationRate)).minor;
  let effective = 0n;
  // Only offsetting movements are effective; the reserve is capped at the hedged change.
  if (
    terms.hedgeType === "cash_flow" &&
    instrument !== 0n &&
    instrument < 0n === hypothetical < 0n
  ) {
    const bounded =
      absolute(instrument) < absolute(hypothetical) ? absolute(instrument) : absolute(hypothetical);
    effective = instrument < 0n ? -bounded : bounded;
  }
  const hedged = -hypothetical;
  const asString = (minor: bigint) => moneyToDecimalString({ minor, currency: functionalCurrency });
  return {
    rate,
    instrumentValue: asString(instrument),
    hedgedChange: asString(terms.hedgeType === "cash_flow" ? hedged : 0n),
    effective: asString(effective),
    ineffective: asString(instrument - effective),
  };
}

interface HedgeAccounts {
  /** Derivative asset (positive fair value) / liability (negative) account, or the cash account on settlement. */
  instrumentAccountId: string;
  reserveAccountId: string | null;
  pnlAccountId: string;
}

const magnitude = (value: string) => Number(value.replace("-", ""));

function side(
  id: string,
  accountId: string,
  value: string,
  debitWhenPositive: boolean,
  description: string,
): JournalLine | null {
  if (Number(value) === 0) return null;
  const positive = !value.startsWith("-");
  const debit = positive === debitWhenPositive;
  return {
    id,
    account_id: accountId,
    debit: debit ? magnitude(value) : 0,
    credit: debit ? 0 : magnitude(value),
    description,
  };
}

/**
 * Dr the instrument (or cash) by the fair value, Cr the reserve by the
 * effective part and P&L by the remainder; signs flip for a loss.
 */
export function buildHedgeValuationLines(
  valuation: HedgeValuation,
  accounts: HedgeAccounts,
  description: string,
): JournalLine[] {
  if (Number(valuation.effective) !== 0 && !accounts.reserveAccountId) {
    throw new RangeError("A cash flow hedge needs a hedge reserve account");
  }
  return [
    side("hedge-1", accounts.instrumentAccountId, valuation.instrumentValue, true, description),
    accounts.reserveAccountId
      ? side(
          "hedge-2",
          accounts.reserveAccountId,
          valuation.effective,
          false,
          `${description} — OCI`,
        )
      : null,
    side("hedge-3", accounts.pnlAccountId, valuation.ineffective, false, `${description} — P&L`),
  ].filter((line): line is JournalLine => line !== null);
}

/** Move the settled reserve balance to profit or loss when the hedged cash flows affect it (IFRS 9.6.5.11(d)). */
export function buildReserveReclassificationLines(
  reserveAmount: string,
  reserveAccountId: string,
  targetAccountId: string,
  description: string,
): JournalLine[] {
  return [
    side("reclass-1", reserveAccountId, reserveAmount, true, description),
    side("reclass-2", targetAccountId, reserveAmount, false, description),
  ].filter((line): line is JournalLine => line !== null);
}
