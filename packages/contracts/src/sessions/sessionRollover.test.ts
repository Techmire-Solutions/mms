import { describe, expect, it } from "vitest";
import {
  defaultPromotionClassMap,
  promotionOutcomeFor,
  sessionRolloverBodySchema,
} from "./sessionRollover.js";

const classes = [
  { id: "hifz-1", programId: "hifz" },
  { id: "nazra-1", programId: "nazra" },
  { id: "hifz-2", programId: "hifz" },
  { id: "hifz-3", programId: "hifz" },
];

describe("defaultPromotionClassMap", () => {
  it("given classes of several programs, should move each to the next class of its own program", () => {
    // Assert
    expect(defaultPromotionClassMap(classes)).toEqual([
      { sourceClassId: "hifz-1", nextClassId: "hifz-2" },
      { sourceClassId: "nazra-1", nextClassId: null },
      { sourceClassId: "hifz-2", nextClassId: "hifz-3" },
      { sourceClassId: "hifz-3", nextClassId: null },
    ]);
  });
});

describe("promotionOutcomeFor", () => {
  const map = defaultPromotionClassMap(classes);

  it("given no override, should promote when there is a next class and graduate otherwise", () => {
    // Assert
    expect(promotionOutcomeFor({ id: "e1", classId: "hifz-1" }, map, new Map())).toEqual({
      outcome: "promote",
      toSourceClassId: "hifz-2",
    });
    expect(promotionOutcomeFor({ id: "e2", classId: "hifz-3" }, map, new Map())).toEqual({
      outcome: "graduate",
      toSourceClassId: null,
    });
  });

  it("given retain or leave overrides, should keep the class or end the enrollment", () => {
    // Arrange
    const overrides = new Map([
      ["e1", "retain" as const],
      ["e2", "leave" as const],
    ]);

    // Assert
    expect(promotionOutcomeFor({ id: "e1", classId: "hifz-1" }, map, overrides)).toEqual({
      outcome: "retain",
      toSourceClassId: "hifz-1",
    });
    expect(promotionOutcomeFor({ id: "e2", classId: "hifz-2" }, map, overrides)).toEqual({
      outcome: "leave",
      toSourceClassId: null,
    });
  });
});

describe("sessionRolloverBodySchema", () => {
  it("given an end before the start, should reject the target", () => {
    // Act
    const parsed = sessionRolloverBodySchema.safeParse({
      mode: "duplicate",
      target: { name: "2027", startDate: "2027-04-01", endDate: "2027-03-01" },
      copy: {},
    });

    // Assert
    expect(parsed.success).toBe(false);
  });
});
