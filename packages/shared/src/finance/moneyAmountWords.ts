/** English amount-in-words for receipts/vouchers, exact via integer cents. */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

function convertChunk(num: number): string {
  let chunkStr = "";
  if (num >= 100) {
    chunkStr += `${ONES[Math.floor(num / 100)]} Hundred `;
    num %= 100;
  }
  if (num >= 20) {
    chunkStr += `${TENS[Math.floor(num / 10)]} `;
    num %= 10;
  }
  if (num > 0) {
    chunkStr += `${ONES[num]} `;
  }
  return chunkStr.trim();
}

/**
 * Formats a numeric amount as capitalized words in English with currency for receipts and vouchers.
 *
 * @param amount - The numeric amount to format.
 * @param currency - Optional currency code or label (e.g. "USD", "PKR").
 * @returns The formatted words representation (e.g. "Five Thousand USD Only").
 */
const WORD_AMOUNT_REGEX = /^(-?)(\d{1,15})(?:\.(\d{1,4}))?$/;

/**
 * Exact decimal → integer cents. Accepts the 2-dp amounts the DTOs carry plus the
 * 4-dp transaction amounts, rounding half-up without ever passing through a float;
 * `parseFloat` on "1234567890123456.01" lost the cent.
 */
function amountToCentsBigInt(amount: number | string): bigint | null {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) return null;
    // A number input is already validated to 2 dp; toFixed makes the digits
    // deterministic before the exact string parse.
    return amountToCentsBigInt(amount.toFixed(2));
  }
  const match = WORD_AMOUNT_REGEX.exec(amount.trim());
  if (!match) return null;
  const sign = match[1] === "-" ? -1n : 1n;
  const whole = BigInt(match[2]);
  const tenThousandths = BigInt((match[3] ?? "").padEnd(4, "0").slice(0, 4));
  // ten-thousandths → cents, half-up: (x + 50) / 100.
  const cents = whole * 100n + (tenThousandths + 50n) / 100n;
  return sign * cents;
}

/**
 * Formats a numeric amount as capitalized words in English with currency for receipts and vouchers.
 *
 * @param amount - The amount (typed decimal string preferred; a number is treated as 2 dp).
 * @param currency - Optional currency code or label (e.g. "USD", "PKR").
 * @returns The formatted words representation (e.g. "Five Thousand USD Only").
 */
export function formatAmountInWords(
  amount: number | string | null | undefined,
  currency?: string,
): string {
  if (amount === null || amount === undefined) return "";
  const cents = amountToCentsBigInt(amount);
  if (cents === null) return "";
  if (cents === 0n) {
    return currency ? `Zero ${currency} Only` : "Zero Only";
  }

  const isNegative = cents < 0n;
  const absCents = isNegative ? -cents : cents;
  const integerPart = absCents / 100n;
  const decimalPart = Number(absCents % 100n);

  let words: string;
  if (integerPart === 0n) {
    words = "Zero";
  } else {
    let rem = integerPart;
    let scaleIdx = 0;
    const parts: string[] = [];

    while (rem > 0n && scaleIdx < SCALES.length) {
      const chunk = Number(rem % 1000n);
      if (chunk !== 0) {
        const chunkText = convertChunk(chunk);
        const scaleText = SCALES[scaleIdx];
        parts.unshift(scaleText ? `${chunkText} ${scaleText}` : chunkText);
      }
      rem /= 1000n;
      scaleIdx++;
    }
    words = parts.join(" ");
  }

  if (decimalPart > 0) {
    words += ` and ${decimalPart.toString().padStart(2, "0")}/100`;
  }

  const prefix = isNegative ? "Minus " : "";
  const currencySuffix = currency ? ` ${currency}` : "";
  return `${prefix}${words}${currencySuffix} Only`.replace(/\s+/g, " ").trim();
}
