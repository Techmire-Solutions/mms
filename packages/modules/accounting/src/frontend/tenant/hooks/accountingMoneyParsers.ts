export type MoneySeparator = "period" | "comma";

/**
 * Separator-aware money input parser for Setup money fields.
 *
 * `Number("1.234")` silently produced 1.234 on a comma-decimal workspace — a
 * 1000× money error — and `Number("1,50")` produced `NaN` on a period one.
 * Grouping separators are accepted **only** in valid thousands groups
 * (`1,234.56` / `1.234,56`) for the configured `decimalSeparator`; anything
 * ambiguous (`1,50` on a period workspace) returns `null` so the field shows a
 * validation message instead of silently rescaling the amount.
 */
export function parseMoneyInput(
  raw: string | null | undefined,
  decimalSeparator: MoneySeparator = "period",
): number | null {
  const body = (raw ?? "").replace(/\s/g, "");
  if (!body) return null;
  const thousands = decimalSeparator === "comma" ? "\\." : ",";
  const decimal = decimalSeparator === "comma" ? "," : "\\.";
  const grouped = new RegExp(`^-?\\d{1,3}(?:${thousands}\\d{3})*(?:${decimal}\\d+)?$`);
  const plain = new RegExp(`^-?\\d+(?:${decimal}\\d+)?$`);
  if (!grouped.test(body) && !plain.test(body)) return null;
  const normalized = body
    .split(decimalSeparator === "comma" ? "." : ",")
    .join("")
    .replace(decimalSeparator === "comma" ? "," : ".", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Mirrors the shared `moneyAmountSchema` precision rule (at most 2 decimals). */
export function hasAtMostTwoDecimals(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value - Math.round(value * 100) / 100) < 1e-9;
}
