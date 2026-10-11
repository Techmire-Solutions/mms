import { describe, expect, it } from "vitest";
import {
  SOFT_DELETE_KEYS,
  isEntityDeleted,
  filterActiveEntities,
  type SoftDeleteFields,
} from "../softDelete.js";

interface TestRecord extends SoftDeleteFields {
  id: string;
  name: string;
}

describe("softDelete shared utilities", () => {
  it("defines the standard soft-delete keys tuple", () => {
    expect(SOFT_DELETE_KEYS).toEqual([
      "deletedAt",
      "deletedBy",
      "deletionReason",
      "restoredAt",
      "restoredBy",
      "deletedWithCascade",
    ]);
  });

  it("correctly identifies whether an entity is soft-deleted", () => {
    const active1: TestRecord = { id: "1", name: "Item 1" };
    const active2: TestRecord = { id: "2", name: "Item 2", deletedAt: null };
    const deleted1: TestRecord = { id: "3", name: "Item 3", deletedAt: new Date() };
    const deleted2: TestRecord = { id: "4", name: "Item 4", deletedAt: "2026-09-10T12:00:00Z" };

    expect(isEntityDeleted(active1)).toBe(false);
    expect(isEntityDeleted(active2)).toBe(false);
    expect(isEntityDeleted(deleted1)).toBe(true);
    expect(isEntityDeleted(deleted2)).toBe(true);
    expect(isEntityDeleted(null)).toBe(false);
    expect(isEntityDeleted(undefined)).toBe(false);
  });

  it("filters out soft-deleted entities from a list", () => {
    const records: TestRecord[] = [
      { id: "1", name: "Active 1" },
      { id: "2", name: "Archived 1", deletedAt: new Date() },
      { id: "3", name: "Active 2", deletedAt: null },
      { id: "4", name: "Archived 2", deletedAt: "2026-09-10T00:00:00.000Z" },
    ];

    const active = filterActiveEntities(records);
    expect(active.map((r) => r.id)).toEqual(["1", "3"]);
  });
});
