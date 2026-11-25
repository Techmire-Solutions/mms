/** `numeric(20,10)` text ("280.5000000000") → the canonical rate string ("280.5"). */
export function canonicalStoredRate(rate: string): string {
  return rate.includes(".") ? rate.replace(/0+$/, "").replace(/\.$/, "") : rate;
}
