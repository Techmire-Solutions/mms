import { describe, expect, it } from "vitest";
import {
  DEFAULT_RELATIONSHIP_PAIRS,
  applyRelationshipOptionOrder,
  deriveRelationshipOptionsFromPairs,
  mergeRelationshipOptionLabels,
  normalizeContactPreferences,
  resolveRelationshipPairs,
} from "./contactPreferenceDefaults.js";

describe("deriveRelationshipOptionsFromPairs", () => {
  it("returns unique forward and inverse labels", () => {
    expect(
      deriveRelationshipOptionsFromPairs([
        { id: "mentor", forward: "Mentor", inverse: "Mentee" },
        { id: "spouse", forward: "Spouse", inverse: "Spouse" },
      ]),
    ).toEqual(["Mentor", "Mentee", "Spouse"]);
  });

  it("includes gendered inverse labels and skips blanks", () => {
    expect(
      deriveRelationshipOptionsFromPairs([
        {
          id: "parent",
          forward: "Parent",
          inverse: "Child",
          inverseMale: "Son",
          inverseFemale: "Daughter",
        },
        { id: "empty", forward: "  ", inverse: "" },
      ]),
    ).toEqual(["Parent", "Child", "Son", "Daughter"]);
  });

  it("dedupes case-insensitively while preserving first casing", () => {
    expect(
      deriveRelationshipOptionsFromPairs([
        { id: "a", forward: "Guardian", inverse: "Dependent" },
        { id: "b", forward: "guardian", inverse: "DEPENDENT" },
      ]),
    ).toEqual(["Guardian", "Dependent"]);
  });
});

describe("mergeRelationshipOptionLabels", () => {
  it("keeps pair labels ahead of existing ad-hoc options", () => {
    expect(mergeRelationshipOptionLabels(["Mentor", "Mentee"], ["Father", "mentor"])).toEqual([
      "Mentor",
      "Mentee",
      "Father",
    ]);
  });
});

describe("resolveRelationshipPairs", () => {
  it("always returns the fixed system catalog", () => {
    expect(DEFAULT_RELATIONSHIP_PAIRS).toHaveLength(3);
    expect(resolveRelationshipPairs(null)).toEqual(DEFAULT_RELATIONSHIP_PAIRS);
    expect(resolveRelationshipPairs([])).toEqual(DEFAULT_RELATIONSHIP_PAIRS);
    expect(
      resolveRelationshipPairs([{ id: "pair_custom", forward: "Mentor", inverse: "Mentee" }]),
    ).toEqual(DEFAULT_RELATIONSHIP_PAIRS);
  });

  it("returns clones so callers cannot mutate defaults", () => {
    const resolved = resolveRelationshipPairs();
    resolved[0]!.forward = "Mutated";
    expect(DEFAULT_RELATIONSHIP_PAIRS[0]!.forward).toBe("Parent");
  });
});

describe("applyRelationshipOptionOrder", () => {
  it("reorders labels to preferred order and drops stale preferred entries", () => {
    expect(
      applyRelationshipOptionOrder(
        ["Father", "Child", "Son", "Daughter"],
        ["Daughter", "Father", "Unknown", "Child"],
      ),
    ).toEqual(["Daughter", "Father", "Child", "Son"]);
  });
});

describe("normalizeContactPreferences", () => {
  it("rewrites empty or custom relationship pairs to the system catalog", () => {
    const normalized = normalizeContactPreferences({
      defaultCity: "Karachi",
      relationshipPairs: [],
    });
    expect(normalized.defaultCity).toBe("Karachi");
    expect(normalized.relationshipPairs).toEqual(DEFAULT_RELATIONSHIP_PAIRS);
    expect(normalized.relationshipOptionOrder).toEqual([
      "Parent",
      "Child",
      "Husband",
      "Wife",
      "Guardian",
      "Dependent",
    ]);
  });

  it("sanitizes relationshipOptionOrder to pair-derived labels", () => {
    const normalized = normalizeContactPreferences({
      relationshipPairs: [
        {
          id: "a",
          forward: "Father",
          inverse: "Child",
          inverseMale: "Son",
          inverseFemale: "Daughter",
        },
      ],
      relationshipOptionOrder: ["Dependent", "Stale", "Parent"],
    });
    expect(normalized.relationshipPairs).toEqual(DEFAULT_RELATIONSHIP_PAIRS);
    expect(normalized.relationshipOptionOrder).toEqual([
      "Dependent",
      "Parent",
      "Child",
      "Husband",
      "Wife",
      "Guardian",
    ]);
  });
});
