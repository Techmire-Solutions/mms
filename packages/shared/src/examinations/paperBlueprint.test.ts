import { describe, expect, it } from "vitest";
import {
  assemblePaperBlueprint,
  BLUEPRINT_LIMITS,
  createSeededRandom,
  fnv1a,
  paperBlueprintSchema,
  type BlueprintCandidate,
  type PaperBlueprint,
} from "./paperBlueprint.js";

function candidate(id: string, overrides: Partial<BlueprintCandidate> = {}): BlueprintCandidate {
  return {
    id,
    difficulty: "easy",
    type: "mcq",
    marks: 1,
    categoryIds: ["fiqh"],
    ...overrides,
  };
}

function pool(count: number): BlueprintCandidate[] {
  return Array.from({ length: count }, (_value, index) =>
    candidate(`q${String(index + 1).padStart(3, "0")}`, {
      difficulty: index % 3 === 0 ? "easy" : index % 3 === 1 ? "medium" : "hard",
      marks: (index % 4) + 1,
    }),
  );
}

const blueprint = (overrides: Partial<PaperBlueprint> = {}): PaperBlueprint => ({
  excludeRecentlyUsedDays: 0,
  buckets: [{ count: 5 }],
  ...overrides,
});

describe("paper blueprint schema", () => {
  it("requires a count or marks target per bucket", () => {
    expect(paperBlueprintSchema.safeParse({ buckets: [{}] }).success).toBe(false);
    expect(paperBlueprintSchema.safeParse({ buckets: [{ count: 0 }] }).success).toBe(true);
    expect(paperBlueprintSchema.safeParse({ buckets: [{ marks: 10 }] }).success).toBe(true);
  });

  it("caps the bucket count", () => {
    const buckets = Array.from({ length: BLUEPRINT_LIMITS.maxBuckets + 1 }, () => ({ count: 1 }));
    expect(paperBlueprintSchema.safeParse({ buckets }).success).toBe(false);
  });
});

describe("seeded randomness", () => {
  it("is reproducible for a seed and divergent across seeds", () => {
    const first = createSeededRandom(fnv1a("seed-a"));
    const second = createSeededRandom(fnv1a("seed-a"));
    const other = createSeededRandom(fnv1a("seed-b"));
    const a = [first(), first(), first()];
    const b = [second(), second(), second()];
    const c = [other(), other(), other()];
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("assemblePaperBlueprint", () => {
  it("is deterministic for the same seed and candidate set", () => {
    const candidates = pool(30);
    const first = assemblePaperBlueprint({ blueprint: blueprint(), candidates, seed: "paper-1" });
    const second = assemblePaperBlueprint({
      blueprint: blueprint(),
      candidates: [...candidates].reverse(),
      seed: "paper-1",
    });

    expect(first.selected.map((row) => row.questionId)).toEqual(
      second.selected.map((row) => row.questionId),
    );
    expect(first.totalMarks).toBe(second.totalMarks);
  });

  it("draws differently for a different seed", () => {
    const candidates = pool(40);
    const first = assemblePaperBlueprint({ blueprint: blueprint(), candidates, seed: "seed-1" });
    const second = assemblePaperBlueprint({ blueprint: blueprint(), candidates, seed: "seed-2" });
    expect(first.selected.map((row) => row.questionId)).not.toEqual(
      second.selected.map((row) => row.questionId),
    );
  });

  it("respects category, difficulty and type predicates", () => {
    const candidates = [
      candidate("a", { categoryIds: ["fiqh"], difficulty: "hard", type: "mcq" }),
      candidate("b", { categoryIds: ["fiqh"], difficulty: "hard", type: "short" }),
      candidate("c", { categoryIds: ["history"], difficulty: "hard", type: "mcq" }),
      candidate("d", { categoryIds: ["fiqh"], difficulty: "easy", type: "mcq" }),
    ];
    const result = assemblePaperBlueprint({
      blueprint: blueprint({
        buckets: [{ categoryId: "fiqh", difficulty: "hard", type: "mcq", count: 5 }],
      }),
      candidates,
      seed: "predicate",
    });
    expect(result.selected.map((row) => row.questionId)).toEqual(["a"]);
  });

  it("never selects a question twice across buckets", () => {
    const result = assemblePaperBlueprint({
      blueprint: blueprint({
        buckets: [
          { categoryId: "fiqh", count: 3 },
          { difficulty: "easy", count: 3 },
        ],
      }),
      candidates: pool(10),
      seed: "no-duplicates",
    });
    const ids = result.selected.map((row) => row.questionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reports a deficit instead of looping when the pool is too small", () => {
    const result = assemblePaperBlueprint({
      blueprint: blueprint({ buckets: [{ count: 5 }] }),
      candidates: pool(2),
      seed: "short",
    });
    expect(result.selected).toHaveLength(2);
    expect(result.deficits).toHaveLength(1);
    expect(result.deficits[0]).toMatchObject({
      bucketIndex: 0,
      requestedCount: 5,
      selectedCount: 2,
      reason: "insufficient_candidates",
    });
  });

  it("reports every bucket as a deficit when the pool is empty", () => {
    const result = assemblePaperBlueprint({
      blueprint: blueprint({ buckets: [{ count: 2 }, { difficulty: "hard", count: 1 }] }),
      candidates: [],
      seed: "empty",
    });
    expect(result.selected).toEqual([]);
    expect(result.deficits).toHaveLength(2);
  });

  it("stops at the marks budget and says why", () => {
    const candidates = Array.from({ length: 10 }, (_value, index) =>
      candidate(`q${index}`, { marks: 5 }),
    );
    const result = assemblePaperBlueprint({
      blueprint: blueprint({ totalMarks: 12, buckets: [{ count: 10 }] }),
      candidates,
      seed: "budget",
    });
    expect(result.totalMarks).toBe(10);
    expect(result.selected).toHaveLength(2);
    expect(result.deficits[0]).toMatchObject({ reason: "marks_budget", selectedCount: 2 });
  });

  it("fills a marks-targeted bucket and reports its partial marks", () => {
    const candidates = Array.from({ length: 4 }, (_value, index) =>
      candidate(`q${index}`, { marks: 2 }),
    );
    const result = assemblePaperBlueprint({
      blueprint: blueprint({ buckets: [{ marks: 10 }] }),
      candidates,
      seed: "marks-target",
    });
    expect(result.totalMarks).toBe(8);
    expect(result.deficits[0]).toMatchObject({ requestedMarks: 10, selectedMarks: 8 });
  });

  it("caps the final selection", () => {
    const result = assemblePaperBlueprint({
      blueprint: blueprint({ buckets: [{ count: BLUEPRINT_LIMITS.maxQuestions + 50 }] }),
      candidates: pool(300),
      seed: "cap",
    });
    expect(result.selected).toHaveLength(BLUEPRINT_LIMITS.maxQuestions);
  });

  it("uses the blueprint seed over the fallback and returns it", () => {
    const result = assemblePaperBlueprint({
      blueprint: blueprint({ seed: "explicit" }),
      candidates: pool(5),
      seed: "fallback",
    });
    expect(result.seedUsed).toBe("explicit");
  });
});
