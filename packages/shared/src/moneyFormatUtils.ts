/**
 * Currency list and locale-aware money/number formatting.
 */

type FinanceCurrencyProvider = () => string | null | undefined;

let financeCurrencyProvider: FinanceCurrencyProvider | null = null;

/**
 * Registers an external source for the active finance currency. The frontend
 * injects this from settings; `@mms/shared` never reads localStorage itself.
 * Pass `null` to clear a previously registered provider.
 */
export function registerFinanceCurrencyProvider(provider: FinanceCurrencyProvider | null): void {
  financeCurrencyProvider = provider;
}

export const DEFAULT_CURRENCIES = [
  { id: "cur1", code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { id: "cur2", code: "USD", name: "US Dollar", symbol: "$" },
  { id: "cur3", code: "GBP", name: "British Pound", symbol: "£" },
  { id: "cur4", code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { id: "cur5", code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { id: "cur6", code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { id: "cur7", code: "EUR", name: "Euro", symbol: "€" }
];

/**
 * Resolves the active finance currency from the registered provider (settings-aware),
 * defaulting to PKR when none is registered.
 */
export function getStoredFinanceCurrency(): string {
  if (financeCurrencyProvider) {
    try {
      const provided = financeCurrencyProvider();
      if (provided) return provided;
    } catch {
      // Ignored
    }
  }
  return "PKR";
}

/**
 * Formats a numeric amount as currency (defaults to settings-aware currency or PKR).
 * @param amount - The numeric or string amount to format.
 * @param currency - The currency symbol/code (defaults to settings-aware currency).
 * @param options - Custom format options (e.g. useSymbol, excludeCurrency, decimal places).
 * @returns The formatted currency string, or "—" if invalid.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency?: string,
  options?: {
    useSymbol?: boolean;
    excludeCurrency?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  if (amount === null || amount === undefined) return "—";
  const numeric = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(numeric)) return "—";

  const resolvedCurrency = currency || getStoredFinanceCurrency();

  const minDigits = options?.minimumFractionDigits ?? 0;
  const maxDigits = options?.maximumFractionDigits ?? 2;

  const formattedNum = numeric.toLocaleString(undefined, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });

  if (options?.excludeCurrency) {
    return formattedNum;
  }

  let prefix = resolvedCurrency;
  if (options?.useSymbol) {
    const found = DEFAULT_CURRENCIES.find((c) => c.code === resolvedCurrency || c.symbol === resolvedCurrency);
    if (found) {
      prefix = found.symbol;
    }
  }

  return `${prefix} ${formattedNum}`;
}

/**
 * Formats a numeric value or count string safely using locale settings.
 * @param value - The numeric or string value to format.
 * @param options - Custom Intl.NumberFormatOptions options.
 * @returns The formatted string, or "0" if null/undefined/NaN.
 */
export function formatNumber(
  value: number | string | readonly (string | number)[] | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined) return "0";
  if (Array.isArray(value)) {
    return value.map((v) => formatNumber(v, options)).join(", ");
  }
  const numeric = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(numeric)) return "0";
  return numeric.toLocaleString(undefined, options);
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

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
export function formatAmountInWords(
  amount: number | string | null | undefined,
  currency?: string
): string {
  if (amount === null || amount === undefined) return "";
  const numeric = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(numeric)) return "";
  if (numeric === 0) {
    return currency ? `Zero ${currency} Only` : "Zero Only";
  }

  const isNegative = numeric < 0;
  const absVal = Math.abs(numeric);
  const fixed = Math.round(absVal * 100) / 100;
  if (fixed === 0) {
    return currency ? `Zero ${currency} Only` : "Zero Only";
  }
  const integerPart = Math.floor(fixed);
  const decimalPart = Math.round((fixed - integerPart) * 100);

  let words: string;
  if (integerPart === 0) {
    words = "Zero";
  } else {
    let rem = integerPart;
    let scaleIdx = 0;
    const parts: string[] = [];

    while (rem > 0 && scaleIdx < SCALES.length) {
      const chunk = rem % 1000;
      if (chunk !== 0) {
        const chunkText = convertChunk(chunk);
        const scaleText = SCALES[scaleIdx];
        parts.unshift(scaleText ? `${chunkText} ${scaleText}` : chunkText);
      }
      rem = Math.floor(rem / 1000);
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
