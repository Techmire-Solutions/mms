/** Normalizes Arabic-Indic (٠-٩) and Extended Arabic-Indic/Persian (۰-۹) digits to ASCII. */
export function normalizeIntlDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => {
    const codePoint = digit.codePointAt(0) ?? 0;
    const base = codePoint >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(codePoint - base);
  });
}

/** Locale-aware integer digits, preserving minimum-width zero padding. */
export function formatIntlInteger(
  value: number,
  minimumIntegerDigits: number,
  locale: string,
): string {
  const formatter = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 0,
  });
  const padded = String(Math.trunc(value)).padStart(minimumIntegerDigits, "0");
  return Array.from(padded)
    .map((digit) => formatter.format(Number(digit)))
    .join("");
}
