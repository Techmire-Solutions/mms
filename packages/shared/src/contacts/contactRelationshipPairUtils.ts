/** Relationship pair defaults and pure helpers for Contacts preferences. */
import type { RelationshipPair } from "./contactEntityTypes.js";

/** Fixed system relationship pairs — the only allowed catalog. */
export const DEFAULT_RELATIONSHIP_PAIRS: RelationshipPair[] = [
  { id: "parent_child", forward: "Parent", inverse: "Child" },
  { id: "husband_wife", forward: "Husband", inverse: "Wife" },
  { id: "guardian_dependent", forward: "Guardian", inverse: "Dependent" },
];

type RelationshipPairLabels = Pick<
  RelationshipPair,
  "forward" | "inverse" | "inverseMale" | "inverseFemale"
>;

/** Normalize relationship labels for case-/punctuation-insensitive matching. */
export function normalizeRelationshipTerm(relationship: unknown): string {
  if (typeof relationship !== "string") return "";
  return relationship
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+in\s+law/g, "-in-law")
    .replace(/\s+/g, " ");
}

/**
 * Always returns a clone of {@link DEFAULT_RELATIONSHIP_PAIRS}.
 * Stored custom / legacy pairs are ignored (hardcoded catalog).
 */
export function resolveRelationshipPairs(_pairs?: RelationshipPair[] | null): RelationshipPair[] {
  return DEFAULT_RELATIONSHIP_PAIRS.map((pair) => ({ ...pair }));
}

/** True when stored pairs already match the system catalog (by id + labels). */
export function relationshipPairsMatchDefaults(pairs?: RelationshipPair[] | null): boolean {
  if (!Array.isArray(pairs) || pairs.length !== DEFAULT_RELATIONSHIP_PAIRS.length) {
    return false;
  }
  for (let index = 0; index < DEFAULT_RELATIONSHIP_PAIRS.length; index += 1) {
    const expected = DEFAULT_RELATIONSHIP_PAIRS[index]!;
    const actual = pairs[index]!;
    if (
      actual.id !== expected.id ||
      normalizeRelationshipTerm(actual.forward) !== normalizeRelationshipTerm(expected.forward) ||
      normalizeRelationshipTerm(actual.inverse) !== normalizeRelationshipTerm(expected.inverse)
    ) {
      return false;
    }
  }
  return true;
}

function relationshipPairLabelList(pair: RelationshipPairLabels): Array<string | undefined> {
  return [pair.forward, pair.inverse, pair.inverseMale, pair.inverseFemale];
}

/**
 * Flattens configured 2-sided relationship pairs into unique dropdown option labels
 * (forward, inverse, and optional gendered inverse labels).
 */
export function deriveRelationshipOptionsFromPairs(pairs: RelationshipPair[]): string[] {
  return uniqueRelationshipLabels(pairs.flatMap((pair) => relationshipPairLabelList(pair)));
}

/**
 * Reorders pair-derived labels to match a preferred UI order (case-insensitive).
 * Labels not in `preferredOrder` append in their derived order. Preferred entries
 * that are not in `labels` are ignored (stale order after removals).
 */
export function applyRelationshipOptionOrder(
  labels: readonly string[],
  preferredOrder?: readonly string[] | null,
): string[] {
  if (!preferredOrder || preferredOrder.length === 0) return [...labels];
  const byKey = new Map(labels.map((label) => [normalizeRelationshipTerm(label), label] as const));
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const preferred of preferredOrder) {
    const key = normalizeRelationshipTerm(preferred);
    if (!key || seen.has(key)) continue;
    const match = byKey.get(key);
    if (!match) continue;
    ordered.push(match);
    seen.add(key);
  }
  for (const label of labels) {
    const key = normalizeRelationshipTerm(label);
    if (seen.has(key)) continue;
    ordered.push(label);
    seen.add(key);
  }
  return ordered;
}

/**
 * Keeps only order entries that still exist in the current label set.
 */
export function sanitizeRelationshipOptionOrder(
  preferredOrder: readonly string[] | null | undefined,
  labels: readonly string[],
): string[] {
  return applyRelationshipOptionOrder(labels, preferredOrder);
}

/**
 * Merges relationship option lists case-insensitively, preserving first-seen casing.
 * Pair-derived labels are listed before existing collection options.
 */
export function mergeRelationshipOptionLabels(
  primaryLabels: readonly (string | undefined | null)[],
  secondaryLabels: readonly (string | undefined | null)[] = [],
): string[] {
  return uniqueRelationshipLabels([...primaryLabels, ...secondaryLabels]);
}

function uniqueRelationshipLabels(labels: readonly (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const label of labels) {
    const trimmed = typeof label === "string" ? label.trim() : "";
    if (!trimmed) continue;
    const key = normalizeRelationshipTerm(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push(trimmed);
  }
  return options;
}

export const RELATIONSHIPS: string[] = deriveRelationshipOptionsFromPairs(
  DEFAULT_RELATIONSHIP_PAIRS,
);
