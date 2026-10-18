/**
 * Exact parsing of user-typed money for the simple-transaction wizard.
 *
 * The wizard's amount field is free text (see `SimpleTransactionStepForm`), so
 * `parseFloat`/`Number` are unsafe there: they read "12,50" as 12 and
 * "1,234.56" as 1, and the wizard posts that truncated number as a *permanent*
 * ledger entry (posted entries are append-only, nothing re-derives the amount).
 *
 * `parseMoneyInput` returns a number only when the input is unambiguous, and
 * `null` for everything else — never a coerced, truncated or `NaN` value — so
 * callers can refuse the input instead of silently posting the wrong amount.
 *
 * Accepted: "1234", "1234.56", "1,234.56", "1234,56", "1.234,56", "1,234,567",
 * ".50", "  12.50  ".
 *
 * Rejected (`null`): "", "abc", "-5", "1.2.3", "12,", "1234.567" (three
 * decimals) and the ambiguous single-separator/three-digit form "12.345" —
 * that is either 12.345 (three decimals, unpostable) or 12,345 (grouping), and
 * guessing is exactly the class of bug this parser exists to prevent. Grouping
 * is honoured only where it cannot be a decimal separator: together with a
 * decimal separator ("1,234.56") or repeated ("1,234,567").
 *
 * The result is finally checked against the server's own `moneyAmountSchema`,
 * so a value only the parser would accept (absurdly large amounts whose cents
 * no longer round-trip through a double) is refused here instead of being
 * posted and bounced by the API.
 */

import { moneyAmountSchema } from "@mms/shared";

/** Characters an amount may consist of; anything else (sign, letters, space) is refused. */
const ALLOWED_CHARACTERS = /^[0-9.,]+$/;
const DECIMAL_DIGITS = /^\d{1,2}$/;
const UNGROUPED_INTEGER_DIGITS = /^\d+$/;
/** More integer digits than this can never survive exact cents arithmetic. */
const MAX_INTEGER_DIGITS = 15;
const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

type MoneySeparator = "." | ",";

function countOccurrences(value: string, character: MoneySeparator): number {
  let count = 0;
  for (const currentCharacter of value) {
    if (currentCharacter === character) count += 1;
  }
  return count;
}

/**
 * Parse a money string into a number with at most two decimals, or `null` when
 * the input cannot be read with confidence.
 */
const CURRENCY_PREFIX_RE = /^(?:[$€£¥₹₨]|(?:Rs\b\.?|(?:PKR|USD|EUR|GBP|SAR|AED|INR)\b))\s*/i;
const CURRENCY_SUFFIX_RE = /\s*(?:[$€£¥₹₨]|(?:Rs\b\.?|(?:PKR|USD|EUR|GBP|SAR|AED|INR)\b))$/i;

export function parseMoneyInput(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  // Clean surrounding whitespace and specific currency symbols/codes
  const cleaned = raw.trim().replace(CURRENCY_PREFIX_RE, "").replace(CURRENCY_SUFFIX_RE, "").trim();
  if (cleaned === "" || !ALLOWED_CHARACTERS.test(cleaned)) return null;

  const dotCount = countOccurrences(cleaned, ".");
  const commaCount = countOccurrences(cleaned, ",");
  const separatorCount = dotCount + commaCount;

  let decimalSeparator: MoneySeparator | null = null;
  let groupingSeparator: MoneySeparator | null = null;

  if (dotCount > 0 && commaCount > 0) {
    // Both separators present: the last one wrote the decimals, the other groups.
    decimalSeparator = cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",") ? "." : ",";
    groupingSeparator = decimalSeparator === "." ? "," : ".";
  } else if (separatorCount === 1) {
    const separator: MoneySeparator = dotCount === 1 ? "." : ",";
    const digitsAfterSeparator = cleaned.length - cleaned.indexOf(separator) - 1;
    // 0 digits: dangling separator. 3+ digits: either more than two decimals or
    // the ambiguous grouping form ("12.345" / "1,234"). Both are refused.
    if (digitsAfterSeparator === 0 || digitsAfterSeparator > 2) return null;
    decimalSeparator = separator;
  } else if (separatorCount > 1) {
    // A number cannot carry two decimal separators, so a repeated one groups.
    groupingSeparator = dotCount > 1 ? "." : ",";
  }

  let integerPart = cleaned;
  let decimalPart = "";
  if (decimalSeparator !== null) {
    const decimalIndex = cleaned.lastIndexOf(decimalSeparator);
    integerPart = cleaned.slice(0, decimalIndex);
    decimalPart = cleaned.slice(decimalIndex + 1);
    if (!DECIMAL_DIGITS.test(decimalPart)) return null;
  }

  if (integerPart === "") {
    // ".5" / ",5" — the leading zero was omitted.
    if (decimalSeparator === null) return null;
    integerPart = "0";
  }

  const groupingPattern =
    groupingSeparator === null
      ? UNGROUPED_INTEGER_DIGITS
      : new RegExp(`^\\d{1,3}(\\${groupingSeparator}\\d{3})*$`);
  if (!groupingPattern.test(integerPart)) return null;

  const integerDigits =
    groupingSeparator === null ? integerPart : integerPart.split(groupingSeparator).join("");
  if (integerDigits === "" || integerDigits.length > MAX_INTEGER_DIGITS) return null;

  // Exact cents arithmetic: the typed value is never multiplied as a float.
  const cents = BigInt(integerDigits) * 100n + BigInt(`${decimalPart}00`.slice(0, 2));
  if (cents > MAX_SAFE_CENTS) return null;

  // Same rule the server applies to every posted line, so an amount accepted
  // here can never be rejected downstream by `moneyAmountSchema`.
  const validated = moneyAmountSchema.safeParse(Number(cents) / 100);
  return validated.success ? validated.data : null;
}
