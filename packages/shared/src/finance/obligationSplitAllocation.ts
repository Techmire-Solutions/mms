/**
 * @file obligationSplitAllocation.ts
 * @description The single allocation rule for splitting an obligation receipt across a wakala's
 * distribution rules.
 *
 * It lives in `@mms/shared` because three callers must not disagree about it:
 *   - the ledger line builder (`buildObligationPostingLines`), which posts the split;
 *   - the frontend summary, which reports what each representative is owed;
 *   - any future projection over the same rules.
 *
 * Before this module the ledger renormalised by the sum of *all* rules while the UI divided the
 * receipt by the *liability* percentages only, so the "due" figure on screen and the liability
 * actually posted diverged whenever a wakala's percentages did not total 100.
 *
 * The algorithm is largest-remainder in integer cents: every rule is floored, then the unallocated
 * cents go to the largest fractional parts (stable by rule order). Rounding each rule
 * independently and dumping the whole residual on the largest line could push that line to zero
 * or below on a small receipt — which dropped it and unbalanced, and therefore silently skipped,
 * the entire posting.
 */

/**
 * Allocates `totalCents` across `percentages`, returning one cent amount per rule.
 *
 * Percentages are normalised by their own sum when it is positive (so 40/40 allocates 50/50 and
 * 60/40 allocates 60/40); an all-zero set falls back to an equal split denominator of 100 and
 * therefore leaves most of the amount unallocated — the caller's balance check rejects that,
 * which is what stops a degenerate rule set from posting.
 *
 * The returned length always equals `percentages.length`. Summing the result equals `totalCents`
 * for every non-degenerate rule set.
 */
export function allocateWakalaSplits(totalCents: number, percentages: readonly number[]): number[] {
  if (percentages.length === 0) return [];
  const safeTotal = Number.isFinite(totalCents) ? Math.trunc(totalCents) : 0;
  if (safeTotal <= 0) return percentages.map(() => 0);

  const weights = percentages.map((percentage) => Math.max(0, Number(percentage) || 0));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const denominator = totalWeight > 0 ? totalWeight : 100;

  const exact = weights.map((weight) => (safeTotal * weight) / denominator);
  const cents = exact.map((value) => Math.floor(value));
  const remainders = exact.map((value, index) => ({ index, remainder: value - cents[index]! }));

  let unallocated = safeTotal - cents.reduce((sum, value) => sum + value, 0);
  if (unallocated > 0) {
    const byRemainder = [...remainders].sort(
      (a, b) => b.remainder - a.remainder || a.index - b.index,
    );
    for (let i = 0; unallocated > 0 && i < byRemainder.length; i += 1, unallocated -= 1) {
      cents[byRemainder[i]!.index]! += 1;
    }
  }

  return cents;
}
