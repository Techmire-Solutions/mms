/**
 * Currency list and locale-aware money/number formatting.
 */
import { findIsoCurrency } from "../money/iso4217.js";
import { moneyToDecimalString, parseMoney } from "../money/money.js";

export { formatAmountInWords } from "./moneyAmountWords.js";

type FinanceCurrencyProvider = () => string | null | undefined;

let financeCurrencyProvider: FinanceCurrencyProvider | null = null;

type FinanceLocaleProvider = () => string | null | undefined;

let financeLocaleProvider: FinanceLocaleProvider | null = null;

/**
 * Registers a source for the active formatting locale (e.g. `ar-PK` for an Urdu
 * or Arabic workspace). `@mms/shared` stays environment-agnostic, so it never
 * reads localStorage itself — the frontend injects this next to the currency
 * provider.
 *
 * Without it every amount fell back to `toLocaleString(undefined, …)`, i.e. the
 * *browser's* locale, so an Arabic workspace saw Latin digits and Western
 * grouping while its translated strings used `Intl.NumberFormat(locale)`.
 */
export function registerFinanceLocaleProvider(provider: FinanceLocaleProvider | null): void {
  financeLocaleProvider = provider;
}

/** Active formatting locale, or `undefined` for the runtime default. */
export function getFinanceFormattingLocale(): string | undefined {
  if (!financeLocaleProvider) return undefined;
  try {
    const provided = financeLocaleProvider();
    return provided?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Exact numeric input for `Intl.NumberFormat`.
 *
 * Decimal strings are parsed through the BigInt money layer and re-emitted as a
 * canonical decimal string, so neither the parse nor the format goes through a
 * float. `parseFloat('1234567890123456789.01')` loses cents at 10^18; a string
 * does not.
 */
function toFormatInput(
  amount: number | string,
  currency: string,
): { value: number | string } | null {
  if (typeof amount === "number") {
    return Number.isFinite(amount) ? { value: amount } : null;
  }
  const raw = amount.trim();
  if (!raw) return null;
  try {
    return { value: moneyToDecimalString(parseMoney(raw, currency)) };
  } catch {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? { value: numeric } : null;
  }
}

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
  { id: "cur7", code: "EUR", name: "Euro", symbol: "€" },
];

/**
 * Resolves the active finance currency from the registered provider (settings-aware),
 * defaulting to PKR when none is registered.
 */
function resolveLocale(explicit?: string): string | undefined {
  const trimmed = explicit?.trim();
  return trimmed || getFinanceFormattingLocale();
}

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
    /** Overrides the registered locale (rarely needed). */
    locale?: string;
  },
): string {
  if (amount === null || amount === undefined) return "—";

  const resolvedCurrency = currency || getStoredFinanceCurrency();
  const input = toFormatInput(amount, resolvedCurrency);
  if (!input) return "—";

  const minDigits = options?.minimumFractionDigits ?? 0;
  const maxDigits = Math.max(
    minDigits,
    options?.maximumFractionDigits ?? findIsoCurrency(resolvedCurrency)?.minorUnits ?? 2,
  );

  const formattedNum = new Intl.NumberFormat(resolveLocale(options?.locale), {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(input.value as number);

  if (options?.excludeCurrency) {
    return formattedNum;
  }

  let prefix = resolvedCurrency;
  if (options?.useSymbol) {
    const found = DEFAULT_CURRENCIES.find(
      (c) => c.code === resolvedCurrency || c.symbol === resolvedCurrency,
    );
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
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined) return "0";
  if (Array.isArray(value)) {
    return value.map((v) => formatNumber(v, options)).join(", ");
  }
  const numeric = typeof value === "number" ? Number(value) : Number(String(value));
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat(resolveLocale(), options).format(numeric);
}

/** Formats a whole percentage using the active locale's numbering system. */
export function formatPercent(
  value: number | string | null | undefined,
  options?: {
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
    signDisplay?: "auto" | "always" | "never" | "exceptZero";
    locale?: string;
  },
): string {
  if (value === null || value === undefined) return "0%";
  const numeric = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(numeric)) return "0%";
  return new Intl.NumberFormat(resolveLocale(options?.locale), {
    style: "percent",
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    minimumFractionDigits: options?.minimumFractionDigits,
    signDisplay: options?.signDisplay,
  }).format(numeric / 100);
}
