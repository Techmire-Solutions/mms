/**
 * IAS 29 restatement in a hyperinflationary functional currency: non-monetary
 * items, equity, and income and expenses are restated by the change in a
 * general price index from the month each amount arose to the reporting date;
 * monetary items are already in current units. The balancing difference is the
 * gain or loss on the net monetary position (IAS 29.27–28).
 */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { divideRounded, moneyToDecimalString, parseMoney } from "../money/money.js";
import { normalizeStoredAmount } from "./accountingFxRevaluation.js";
import type { JournalLine } from "./accountingModuleManifest.js";

const INDEX_SCALE = 6;

export const priceIndexPointSchema = z
  .object({
    indexDate: isoDateSchema,
    /** General price index level (e.g. CPI), positive, up to 6 decimals. */
    value: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/, "accounting.validation.priceIndex"),
    source: z.string().trim().max(120).default(""),
  })
  .strict()
  .refine((point) => Number(point.value) > 0, {
    message: "accounting.validation.priceIndex",
    path: ["value"],
  });

export type PriceIndexPoint = z.infer<typeof priceIndexPointSchema>;

export const priceIndexPutSchema = z
  .object({ points: z.array(priceIndexPointSchema).min(1).max(600) })
  .strict();

/** One account's net functional movement in one calendar month (debit-positive decimal string). */
export interface MonthlyMovement {
  accountId: string;
  accountCode: string;
  accountName: string;
  type: string;
  isMonetary: boolean;
  /** YYYY-MM */
  month: string;
  netFunc: string;
}

export interface Ias29Line {
  accountId: string;
  accountCode: string;
  accountName: string;
  carrying: string;
  restated: string;
  adjustment: string;
}

export interface Ias29Restatement {
  restatementDate: string;
  closingIndex: string;
  lines: Ias29Line[];
  /** Net of all adjustments; offset on the monetary account: positive = gain, negative = loss. */
  netMonetaryResult: string;
}

/** Raised when a month with activity has no index on or before its end. */
export class MissingPriceIndexError extends Error {
  constructor(readonly months: readonly string[]) {
    super(`No price index on or before the end of ${months.join(", ")}`);
    this.name = "MissingPriceIndexError";
  }
}

const scaled = (value: string): bigint => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole + fraction.padEnd(INDEX_SCALE, "0").slice(0, INDEX_SCALE));
};

const monthEnd = (month: string): string => {
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
};

/** Latest index on or before `date` (points need not be sorted). */
export function indexOnOrBefore(points: readonly PriceIndexPoint[], date: string): string | null {
  let best: PriceIndexPoint | null = null;
  for (const point of points) {
    if (point.indexDate <= date && (!best || point.indexDate > best.indexDate)) best = point;
  }
  return best?.value ?? null;
}

/** Non-monetary balance sheet items, equity, income and expense are restated; monetary items are not. */
export function isRestatedByIas29(movement: Pick<MonthlyMovement, "type" | "isMonetary">): boolean {
  if (movement.type === "Asset" || movement.type === "Liability") return !movement.isMonetary;
  return movement.type === "Equity" || movement.type === "Revenue" || movement.type === "Expense";
}

/**
 * Restate each non-monetary account: Σ movement × closingIndex / index(month),
 * rounded to the functional currency; the adjustment is restated − carrying,
 * and their sum is the net monetary position result (negative = loss).
 */
export function computeIas29Restatement(
  movements: readonly MonthlyMovement[],
  points: readonly PriceIndexPoint[],
  restatementDate: string,
  functionalCurrency: string,
): Ias29Restatement {
  const closingIndex = indexOnOrBefore(points, restatementDate);
  const relevant = movements.filter(isRestatedByIas29);
  const missing = new Set<string>();
  if (!closingIndex) missing.add(restatementDate.slice(0, 7));
  for (const movement of relevant) {
    if (!indexOnOrBefore(points, monthEnd(movement.month))) missing.add(movement.month);
  }
  if (missing.size > 0) throw new MissingPriceIndexError([...missing].sort());

  const closing = scaled(closingIndex as string);
  const byAccount = new Map<
    string,
    {
      line: Omit<Ias29Line, "carrying" | "restated" | "adjustment">;
      carrying: bigint;
      restated: bigint;
    }
  >();
  for (const movement of relevant) {
    const amount = parseMoney(
      normalizeStoredAmount(movement.netFunc, functionalCurrency),
      functionalCurrency,
    ).minor;
    const index = scaled(indexOnOrBefore(points, monthEnd(movement.month)) as string);
    const restated = divideRounded(amount * closing, index);
    const entry = byAccount.get(movement.accountId) ?? {
      line: {
        accountId: movement.accountId,
        accountCode: movement.accountCode,
        accountName: movement.accountName,
      },
      carrying: 0n,
      restated: 0n,
    };
    entry.carrying += amount;
    entry.restated += restated;
    byAccount.set(movement.accountId, entry);
  }

  const asString = (minor: bigint) => moneyToDecimalString({ minor, currency: functionalCurrency });
  let net = 0n;
  const lines: Ias29Line[] = [];
  for (const { line, carrying, restated } of byAccount.values()) {
    const adjustment = restated - carrying;
    if (adjustment === 0n) continue;
    net += adjustment;
    lines.push({
      ...line,
      carrying: asString(carrying),
      restated: asString(restated),
      adjustment: asString(adjustment),
    });
  }
  lines.sort((left, right) => left.accountCode.localeCompare(right.accountCode));
  return {
    restatementDate,
    closingIndex: closingIndex as string,
    lines,
    netMonetaryResult: asString(net),
  };
}

/**
 * Journal lines: each account's restatement adjustment (Dr when the restated
 * debit balance grows), offset on the net monetary position account. A net
 * debit adjustment is a monetary gain (credit), and vice versa.
 */
export function buildIas29JournalLines(
  restatement: Ias29Restatement,
  netMonetaryAccountId: string,
  functionalCurrency: string,
): JournalLine[] {
  const magnitude = (value: string) => Number(value.replace("-", ""));
  const journal: JournalLine[] = restatement.lines.map((line, index) => ({
    id: `ias29-${index + 1}`,
    account_id: line.accountId,
    debit: line.adjustment.startsWith("-") ? 0 : magnitude(line.adjustment),
    credit: line.adjustment.startsWith("-") ? magnitude(line.adjustment) : 0,
    description: `IAS 29 restatement @ index ${restatement.closingIndex}`,
  }));
  const net = parseMoney(restatement.netMonetaryResult, functionalCurrency).minor;
  if (net !== 0n) {
    const value = magnitude(restatement.netMonetaryResult);
    journal.push({
      id: "ias29-nmp",
      account_id: netMonetaryAccountId,
      debit: net < 0n ? value : 0,
      credit: net > 0n ? value : 0,
      description: "Gain/loss on net monetary position (IAS 29)",
    });
  }
  return journal;
}
