import { describe, expect, it } from "vitest";
import { CONTACT_LIST_COLUMNS } from "../db/repositories/contactRepositoryList.js";

/**
 * The Work directory projection must carry every column the row mapper hydrates
 * into a `Contact`. Missing keys silently became `undefined` because the mapper
 * casts projected rows to the full table type.
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
    expect(Object.keys(CONTACT_LIST_COLUMNS).sort()).toEqual(
      expect.arrayContaining(requiredColumns),
    );
  });
});
