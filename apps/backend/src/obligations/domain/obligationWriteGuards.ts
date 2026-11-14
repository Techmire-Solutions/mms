/**
 * @file obligationWriteGuards.ts
 * @description Pure domain rules for the Obligations module.
 *
 * These are the module's actual invariants. Before this file the module had none: the use cases
 * were pass-throughs to a generic CRUD service, so every rule lived either in the browser or
 * nowhere at all. Each guard is pure (no I/O) so it is unit-testable and so the same rule can be
 * applied by the API, the CSV import and a future worker.
 */
import type { ObligationDistribution, WakalaType } from "@mms/shared";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";

/** The collection fields the ledger split depends on. */
export interface ObligationReceiptRef {
  obligation_type_id: string;
  mujtahid_representative_id: string;
}

/**
 * The wakala that governs a receipt, matching the pair the posting service resolves.
 *
 * Extracted so the write guard and the ledger posting cannot drift: a receipt is only postable
 * when this returns a wakala, and `resolveDistributionRules` uses the same lookup.
 */
export function findWakalaForReceipt(
  receipt: ObligationReceiptRef,
  wakalas: readonly WakalaType[],
): WakalaType | null {
  return (
    wakalas.find(
      (candidate) =>
        candidate.obligation_type_id === receipt.obligation_type_id &&
        candidate.mujtahid_representative_id === receipt.mujtahid_representative_id,
    ) ?? null
  );
}

/**
 * Rejects a receipt whose type/representative pair has no wakala.
 *
 * Without this the receipt still saved and the posting engine fell back to crediting 100 % to the
 * default income account (`buildObligationPostingLines`, "no distributions configured"), silently
 * turning a wakala liability into income. The browser filtered the representative picker to pairs
 * that have a wakala, so the rule existed only in the UI.
 */
export function assertReceiptHasWakala(
  receipt: ObligationReceiptRef,
  wakalas: readonly WakalaType[],
): void {
  if (findWakalaForReceipt(receipt, wakalas)) return;
  throw new ValidationError(
    "No wakala is configured for this obligation type and representative, so the receipt cannot be split and posted",
    "obligation_wakala_required",
  );
}

/** Total of a wakala's distribution percentages, in hundredths of a percent to avoid float drift. */
export function splitRuleTotalBasisPoints(rules: readonly { percentage: number }[]): number {
  return rules.reduce((sum, rule) => sum + Math.round((Number(rule.percentage) || 0) * 100), 0);
}

/**
 * Rejects a wakala whose distribution rules form an incomplete set.
 *
 * An empty rule set is allowed: it is the documented "not configured yet" state and the fallback
 * path covers it. A *partial* set (say 60 %) is rejected because the posting engine renormalises
 * by the sum of the rules, so 40/20 would silently post 67/33 while the Setup screen claims 60 %.
 * The comparison is in basis points, so 33.33 + 33.33 + 33.34 is exactly 100 %.
 */
export function assertSplitRulesComplete(
  wakalas: readonly WakalaType[],
  distributions: readonly ObligationDistribution[],
): void {
  for (const wakala of wakalas) {
    const rules = distributions.filter((rule) => rule.wakala_type_id === wakala.id);
    if (rules.length === 0) continue;
    const total = splitRuleTotalBasisPoints(rules);
    if (total === 10_000) continue;
    throw new ValidationError(
      `Wakala ${wakala.id} distribution percentages total ${(total / 100).toFixed(2)}%, expected 100%`,
      "obligation_split_incomplete",
    );
  }
}

/**
 * Rows a catalogue delete would take with it through the cascade chain.
 *
 * The shape lives with the counter that produces it (`obligationCatalogueDependentsRepository`); it
 * used to be re-declared here, which is how `receipts` went missing from one copy (audit G3).
 */
export type { CatalogueDependents } from "../../db/repositories/obligationCatalogueDependentsRepository.js";
import type { CatalogueDependents } from "../../db/repositories/obligationCatalogueDependentsRepository.js";

/**
 * Refuses a catalogue replace that would cascade-delete referenced rows.
 *
 * `mujtahids → mujtahid_reps → wakala_types → obligation_distributions` is a three-level
 * `ON DELETE CASCADE`, and every `replace*ForWorkspace` deletes the rows the caller omitted. A
 * `PUT /mujtahids/bulk` with a shortened list therefore wiped the wakalas *and* their split rules
 * without a word: past receipts kept their ledger entries, and every later receipt posted 100 %
 * to income. Until the FKs move to RESTRICT, the policy lives here.
 */
export function assertNoCascadingLoss(
  kind: "mujtahid" | "representative" | "wakala type" | "obligation type",
  doomedIds: readonly string[],
  dependents: CatalogueDependents,
): void {
  // A receipt is a financial document: the FK from `obligation_collections` is ON DELETE CASCADE,
  // so a catalogue replace that omits a referenced row would delete the receipt with it. Receipts
  // are counted alongside the wakala/rule dependents (test-suite audit G3).
  if (dependents.wakalaTypes === 0 && dependents.distributions === 0 && dependents.receipts === 0) {
    return;
  }
  const ids = doomedIds.slice(0, 5).join(", ");
  const more = doomedIds.length > 5 ? ` (+${doomedIds.length - 5} more)` : "";
  throw new ConflictError(
    `Cannot delete ${doomedIds.length} ${kind}${doomedIds.length === 1 ? "" : "s"} ${ids}${more}: ` +
      `${dependents.receipts} receipt(s), ${dependents.wakalaTypes} wakala type(s) and ` +
      `${dependents.distributions} distribution rule(s) still reference them`,
    "catalogue_in_use",
    {
      kind,
      removedIds: [...doomedIds],
      receipts: dependents.receipts,
      wakalaTypes: dependents.wakalaTypes,
      distributions: dependents.distributions,
    },
  );
}
