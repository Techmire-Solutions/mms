import { describe, expect, it } from "vitest";
import { contactSelectColumns } from "../db/repositories/contactRepositoryColumns.js";

/**
 * The Work directory projection (and every id-based hydrate) must carry every
 * column the row mapper hydrates into a `Contact`. Missing keys silently became
 * `undefined` because the mapper casts projected rows to the full table type.
 *
 * There is one projection map (`contactSelectColumns`); this spec pins it so a
 * future trimming of the constant cannot silently drop a hydrated column.
 */
describe("contactRepositoryList projection", () => {
  const requiredColumns = [
    "id",
    "firstName",
    "lastName",
    "name",
    "gender",
    "dob",
    "cnic",
    "isSyed",
    "avatar",
    "notes",
    "aiSummary",
    "whatsappStatus",
    "lastCheckedAt",
    "deletedAt",
    "deletedBy",
    "deletionReason",
    "deletedWithCascade",
    "restoredAt",
    "restoredBy",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy",
  ];

  it("projects every hydrated contact column, including restore provenance", () => {
    expect(Object.keys(contactSelectColumns).sort()).toEqual(
      expect.arrayContaining(requiredColumns),
    );
  });
});
