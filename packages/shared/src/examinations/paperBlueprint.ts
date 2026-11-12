/**
 * @file paperBlueprint.ts
 * @description Deterministic, bounded paper-assembly engine for the Question Bank.
 *
 * A blueprint is an ordered list of buckets (topic/category × difficulty × type) with a target count
 * and/or target marks, plus an optional global marks budget and a recency window. The engine picks
 * questions with a seeded PRNG so the same blueprint + seed + candidate set always produces the same
 * paper.
 *
 * Two properties are deliberate:
 *   - **No retry loop.** Each bucket is a single pass over its filtered candidates. When a bucket
 *     cannot be filled the engine reports a deficit instead of shuffling again — a rejection loop
 *     would spin forever once the pool is exhausted.
 *   - **Bounded work.** Buckets, candidates and the final selection are capped, and the complexity is
 *     `O(buckets × candidates)` with no recursion.
 *
 * Domain only: no I/O, no tenant context, no dates.
 */
import { z } from "zod";
import { questionDifficultySchema, questionTypeSchema } from "./questionBankModuleManifest.js";
import type { QuestionDifficulty, QuestionType } from "./questionBankCore.js";

export const BLUEPRINT_LIMITS = {
  maxBuckets: 40,
  maxCandidates: 5000,
  maxQuestions: 200,
} as const;

export const paperBlueprintBucketSchema = z
  .object({
    /** Topic dimension — a question-bank category id (there is no `topics` table yet). */
    categoryId: z.string().trim().max(64).optional(),
    difficulty: questionDifficultySchema.optional(),
    type: questionTypeSchema.optional(),
    /** How many questions this bucket should contribute. */
    count: z.number().int().nonnegative().max(BLUEPRINT_LIMITS.maxQuestions).optional(),
    /** How many marks this bucket should contribute. */
    marks: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((bucket, ctx) => {
    if (bucket.count === undefined && bucket.marks === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["count"],
        message: "questionBank.blueprint.bucketTargetRequired",
      });
    }
  });

export const paperBlueprintSchema = z
  .object({
    /** Optional blueprint-level seed; the endpoint falls back to the paper id. */
    seed: z.string().trim().min(1).max(64).optional(),
    /** Hard ceiling for the whole paper. */
    totalMarks: z.number().int().positive().optional(),
    /** Exclude questions used by any paper created in the last N days. */
    excludeRecentlyUsedDays: z.number().int().min(0).max(365).default(0),
    buckets: z.array(paperBlueprintBucketSchema).min(1).max(BLUEPRINT_LIMITS.maxBuckets),
  })
  .strict();

export const blueprintDeficitSchema = z
  .object({
    bucketIndex: z.number().int().nonnegative(),
    requestedCount: z.number().int().nonnegative(),
    selectedCount: z.number().int().nonnegative(),
    requestedMarks: z.number().int().nonnegative(),
    selectedMarks: z.number().int().nonnegative(),
    reason: z.enum(["insufficient_candidates", "marks_budget"]),
  })
  .strict();

export type PaperBlueprintBucket = z.infer<typeof paperBlueprintBucketSchema>;
export type PaperBlueprint = z.infer<typeof paperBlueprintSchema>;

export interface BlueprintCandidate {
  id: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  marks: number;
  categoryIds: readonly string[];
}

export interface BlueprintDeficit {
  bucketIndex: number;
  requestedCount: number;
  selectedCount: number;
  requestedMarks: number;
  selectedMarks: number;
  reason: "insufficient_candidates" | "marks_budget";
}

export interface BlueprintSelection {
  questionId: string;
  bucketIndex: number;
}

export interface BlueprintResult {
  seedUsed: string;
  selected: BlueprintSelection[];
  totalMarks: number;
  deficits: BlueprintDeficit[];
}

/** FNV-1a — a small, stable string hash so a seed is reproducible across processes. */
export function fnv1a(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32 — deterministic PRNG in [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function matchesBucket(candidate: BlueprintCandidate, bucket: PaperBlueprintBucket): boolean {
  if (bucket.difficulty && candidate.difficulty !== bucket.difficulty) return false;
  if (bucket.type && candidate.type !== bucket.type) return false;
  if (bucket.categoryId && !candidate.categoryIds.includes(bucket.categoryId)) return false;
  return true;
}

function marksOf(candidate: BlueprintCandidate): number {
  return Number.isInteger(candidate.marks) && candidate.marks > 0 ? candidate.marks : 1;
}

/**
 * Assemble a paper from a blueprint.
 *
 * Deterministic inputs: `blueprint.seed ?? seed`, the candidate set and the bucket order. Candidates
 * are sorted by id before shuffling, so an unordered database result cannot change the draw.
 */
export function assemblePaperBlueprint(input: {
  blueprint: PaperBlueprint;
  candidates: readonly BlueprintCandidate[];
  seed: string;
}): BlueprintResult {
  const { blueprint } = input;
  const seedUsed = blueprint.seed ?? input.seed;
  const random = createSeededRandom(fnv1a(seedUsed));

  // Stable ordering is the determinism anchor; the cap keeps the pass bounded.
  const candidates = [...input.candidates]
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    .slice(0, BLUEPRINT_LIMITS.maxCandidates);

  const used = new Set<string>();
  const selected: BlueprintSelection[] = [];
  const deficits: BlueprintDeficit[] = [];
  let totalMarks = 0;

  for (let bucketIndex = 0; bucketIndex < blueprint.buckets.length; bucketIndex += 1) {
    const bucket = blueprint.buckets[bucketIndex];
    const requestedCount = bucket.count ?? 0;
    const requestedMarks = bucket.marks ?? 0;
    let selectedCount = 0;
    let selectedMarks = 0;
    let reason: BlueprintDeficit["reason"] = "insufficient_candidates";

    const pool = shuffle(
      candidates.filter((candidate) => !used.has(candidate.id) && matchesBucket(candidate, bucket)),
      random,
    );

    // Single pass: stop at the bucket target, the global question cap or an exhausted pool.
    for (const candidate of pool) {
      if (selectedCount >= BLUEPRINT_LIMITS.maxQuestions) break;
      if (bucket.count !== undefined && selectedCount >= bucket.count) break;
      if (bucket.marks !== undefined && selectedMarks >= bucket.marks) break;
      if (selected.length >= BLUEPRINT_LIMITS.maxQuestions) break;

      const marks = marksOf(candidate);
      if (blueprint.totalMarks !== undefined && totalMarks + marks > blueprint.totalMarks) {
        // Skip this candidate; a later, cheaper one may still fit. No retry of the bucket.
        reason = "marks_budget";
        continue;
      }

      used.add(candidate.id);
      selected.push({ questionId: candidate.id, bucketIndex });
      selectedCount += 1;
      selectedMarks += marks;
      totalMarks += marks;
    }

    const countShort = bucket.count !== undefined && selectedCount < bucket.count;
    const marksShort = bucket.marks !== undefined && selectedMarks < bucket.marks;
    if ((countShort || marksShort) && (bucket.count !== undefined || bucket.marks !== undefined)) {
      deficits.push({
        bucketIndex,
        requestedCount,
        selectedCount,
        requestedMarks,
        selectedMarks,
        reason,
      });
    }
  }

  return { seedUsed, selected, totalMarks, deficits };
}
