import { describe, expect, it } from "vitest";
import type { Contact } from "./contactEntityTypes.js";
import { normalizeRelationshipTerm } from "./contactRelationshipPairUtils.js";
import {
  formatRelationshipDisplayLabel,
  isAllowedRelationshipLabel,
  resolveInverseRelationship,
} from "./contactRelationshipRules.js";

function contact(partial: Partial<Contact> & { id: string }): Contact {
  return {
    firstName: "Test",
    lastName: "User",
    ...partial,
  } as Contact;
}

describe("normalizeRelationshipTerm", () => {
  it("lowercases, trims, and normalizes in-law spacing", () => {
    expect(normalizeRelationshipTerm("  Father-In-Law  ")).toBe("father-in-law");
    expect(normalizeRelationshipTerm("Brother in Law")).toBe("brother-in-law");
    expect(normalizeRelationshipTerm("Aunt_Uncle")).toBe("aunt-uncle");
  });

  it("returns empty for non-strings", () => {
    expect(normalizeRelationshipTerm(null)).toBe("");
    expect(normalizeRelationshipTerm(12)).toBe("");
  });
});

describe("resolveInverseRelationship", () => {
  it("returns null for labels outside the system catalog", () => {
    expect(resolveInverseRelationship("Father", contact({ id: "1", gender: "female" }))).toBeNull();
    expect(
      resolveInverseRelationship("Father", contact({ id: "1", gender: "female" }), []),
    ).toBeNull();
  });

  it("uses system pairs when custom pairs are omitted", () => {
    expect(resolveInverseRelationship("Parent", contact({ id: "1", gender: "male" }))).toBe(
      "Child",
    );
    expect(resolveInverseRelationship("Wife", contact({ id: "1", gender: "female" }))).toBe(
      "Husband",
    );
  });

  it("uses custom pair inverse when configured", () => {
    expect(
      resolveInverseRelationship("Mentor", contact({ id: "1", gender: "male" }), [
        { id: "pair_1", forward: "Mentor", inverse: "Mentee" },
      ]),
    ).toBe("Mentee");
  });

  it("returns exact pair.forward for inverse side (no gender rewrite)", () => {
    expect(
      resolveInverseRelationship("Son", contact({ id: "1", gender: "female" }), [
        {
          id: "pair_1",
          forward: "Father",
          inverse: "Child",
          inverseMale: "Son",
          inverseFemale: "Daughter",
        },
      ]),
    ).toBe("Father");
  });

  it("returns gendered inverse when matching forward", () => {
    const pair = {
      id: "pair_1",
      forward: "Father",
      inverse: "Child",
      inverseMale: "Son",
      inverseFemale: "Daughter",
    };
    expect(
      resolveInverseRelationship("Father", contact({ id: "1", gender: "female" }), [pair]),
    ).toBe("Daughter");
    expect(resolveInverseRelationship("Father", contact({ id: "2", gender: "male" }), [pair])).toBe(
      "Son",
    );
  });
});

describe("formatRelationshipDisplayLabel", () => {
  it("maps Parent/Child by linked gender", () => {
    expect(formatRelationshipDisplayLabel("Parent", "female")).toBe("Mother");
    expect(formatRelationshipDisplayLabel("Parent", "male")).toBe("Father");
    expect(formatRelationshipDisplayLabel("Child", "female")).toBe("Daughter");
    expect(formatRelationshipDisplayLabel("Child", "male")).toBe("Son");
  });

  it("keeps Parent/Child when gender is unknown", () => {
    expect(formatRelationshipDisplayLabel("Parent", undefined)).toBe("Parent");
    expect(formatRelationshipDisplayLabel("Child", "")).toBe("Child");
    expect(formatRelationshipDisplayLabel("Parent", "other")).toBe("Parent");
  });

  it("maps Sibling by linked gender", () => {
    expect(formatRelationshipDisplayLabel("Sibling", "female")).toBe("Sister");
    expect(formatRelationshipDisplayLabel("Sibling", "male")).toBe("Brother");
    expect(formatRelationshipDisplayLabel("Sibling", undefined)).toBe("Sibling");
  });

  it("leaves other catalog labels unchanged", () => {
    expect(formatRelationshipDisplayLabel("Guardian", "female")).toBe("Guardian");
    expect(formatRelationshipDisplayLabel("Husband", "male")).toBe("Husband");
  });

  it("is case-insensitive on the stored relationship term", () => {
    expect(formatRelationshipDisplayLabel("parent", "Woman")).toBe("Mother");
    expect(formatRelationshipDisplayLabel("CHILD", "Boy")).toBe("Son");
  });
});

describe("isAllowedRelationshipLabel", () => {
  it("allows only system catalog labels by default", () => {
    expect(isAllowedRelationshipLabel("Parent")).toBe(true);
    expect(isAllowedRelationshipLabel("dependent")).toBe(true);
    expect(isAllowedRelationshipLabel("Mentor")).toBe(false);
    expect(isAllowedRelationshipLabel("Father")).toBe(false);
  });

  it("allows only pair-derived labels when pairs are provided", () => {
    const pairs = [
      {
        id: "pair_1",
        forward: "Father",
        inverse: "Child",
        inverseMale: "Son",
        inverseFemale: "Daughter",
      },
    ];
    expect(isAllowedRelationshipLabel("Father", pairs)).toBe(true);
    expect(isAllowedRelationshipLabel("daughter", pairs)).toBe(true);
    expect(isAllowedRelationshipLabel("Mother", pairs)).toBe(false);
    expect(isAllowedRelationshipLabel("Grandfather", pairs)).toBe(false);
    expect(isAllowedRelationshipLabel("Grandfather", [])).toBe(false);
  });
});
