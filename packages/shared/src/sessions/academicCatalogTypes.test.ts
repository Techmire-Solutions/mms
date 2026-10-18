import { describe, expect, it } from "vitest";
import {
  ACADEMIC_CATALOG_KINDS,
  DEFAULT_ACADEMIC_CATALOG_SEEDS,
  academicCatalogNameKey,
  academicCatalogWriteSchema,
  activeAcademicCatalogItems,
  type AcademicCatalogItem,
} from "./academicCatalogTypes.js";

function item(overrides: Partial<AcademicCatalogItem>): AcademicCatalogItem {
  return {
    id: "id-1",
    code: null,
    name: "Fiqh",
    shortName: null,
    status: "active",
    sortOrder: 0,
    isSystem: false,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("academicCatalogWriteSchema", () => {
  it("given padded text and empty optionals, should trim the name and null blank code/shortName when parsed", () => {
    // Arrange
    const body = { name: "  Arabic  ", code: "", shortName: "   " };

    // Act
    const parsed = academicCatalogWriteSchema.parse(body);

    // Assert
    expect(parsed).toEqual({ name: "Arabic", code: null, shortName: null, status: "active" });
  });

  it("given a blank name or unknown key, should reject the body when parsed", () => {
    // Arrange
    const blank = { name: "   " };
    const extra = { name: "Arabic", colour: "red" };

    // Act
    const blankResult = academicCatalogWriteSchema.safeParse(blank);
    const extraResult = academicCatalogWriteSchema.safeParse(extra);

    // Assert
    expect(blankResult.success).toBe(false);
    expect(extraResult.success).toBe(false);
  });
});

describe("activeAcademicCatalogItems", () => {
  it("given archived, deleted and unordered rows, should return active rows by sortOrder then name when filtered", () => {
    // Arrange
    const rows = [
      item({ id: "b", name: "Tajweed", sortOrder: 1 }),
      item({ id: "a", name: "Arabic", sortOrder: 1 }),
      item({ id: "z", name: "Zero", sortOrder: 0 }),
      item({ id: "x", name: "Archived", status: "archived" }),
      item({ id: "d", name: "Deleted", deletedAt: "2026-02-01T00:00:00.000Z" }),
    ];

    // Act
    const ids = activeAcademicCatalogItems(rows).map((row) => row.id);

    // Assert
    expect(ids).toEqual(["z", "a", "b"]);
  });
});

describe("academic catalog seeds", () => {
  it("given every catalog kind, should provide unique seed names and codes when keyed", () => {
    // Arrange
    const kinds = ACADEMIC_CATALOG_KINDS;

    // Act
    const duplicates = kinds.filter((kind) => {
      const seeds = DEFAULT_ACADEMIC_CATALOG_SEEDS[kind];
      const names = new Set(seeds.map((seed) => academicCatalogNameKey(seed.name)));
      const codes = new Set(seeds.map((seed) => seed.code));
      return names.size !== seeds.length || codes.size !== seeds.length;
    });

    // Assert
    expect(duplicates).toEqual([]);
    expect(academicCatalogNameKey("  Dars-e-Nizami ")).toBe("dars-e-nizami");
  });
});
