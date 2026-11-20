import { describe, expect, it } from "vitest";
import { sessionSelectColumns } from "../db/repositories/sessionRepositoryQueries.js";

/**
 * Top-level `sessions` columns that `sessionRowToRecord` reads (including the audit/soft-delete
 * fields via `mapAuditTimestamps`). Kept as an explicit list so a column dropped from the projection
 * (or a new column the mapper starts reading) fails here instead of silently hydrating `undefined`.
 */
const MAPPER_READ_COLUMNS = [
  "id",
  "name",
  "status",
  "type",
  "categoryId",
  "programId",
  "startDate",
  "endDate",
  "baseFee",
  "currency",
  "description",
  "minAttendancePct",
  "requiresExamPass",
  "version",
  "overlapExempt",
  "deletedAt",
  "deletedBy",
  "deletionReason",
  "restoredAt",
  "restoredBy",
  "deletedWithCascade",
  "createdAt",
  "updatedAt",
] as const;

describe("sessionSelectColumns", () => {
  it("projects every top-level column sessionRowToRecord reads", () => {
    const projected = new Set(Object.keys(sessionSelectColumns));
    for (const column of MAPPER_READ_COLUMNS) {
      expect(projected.has(column), `sessionSelectColumns is missing "${column}"`).toBe(true);
    }
  });
});
