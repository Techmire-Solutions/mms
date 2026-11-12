import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  QUESTION_DIFFICULTIES,
  QUESTION_LANGUAGES,
  QUESTION_STATUSES,
  QUESTION_TYPES,
} from "@mms/shared";

/**
 * Pins the database CHECK constraints to the shared taxonomy arrays. Lives in the backend because
 * only this package can read migration files; the shared package stays pure.
 */
describe("question taxonomy ↔ database constraints", () => {
  const migrationDir = path.resolve(import.meta.dirname, "../db/migrations_drizzle");

  it("enforces every type, difficulty and language in migration 0243", () => {
    const sql = readFileSync(
      path.join(migrationDir, "0243_question_bank_taxonomy_checks.sql"),
      "utf-8",
    );
    for (const value of QUESTION_TYPES) expect(sql).toContain(`'${value}'`);
    for (const value of QUESTION_DIFFICULTIES) expect(sql).toContain(`'${value}'`);
    for (const value of QUESTION_LANGUAGES) expect(sql).toContain(`'${value}'`);
  });

  it("enforces every status in migration 0241", () => {
    const sql = readFileSync(
      path.join(migrationDir, "0241_question_bank_lifecycle_and_marks.sql"),
      "utf-8",
    );
    for (const value of QUESTION_STATUSES) expect(sql).toContain(`'${value}'`);
  });
});
