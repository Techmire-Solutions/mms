import { describe, expect, it } from "vitest";
import { findUnappliedMigrations, type DrizzleJournalEntry } from "./checkMigrations.js";

/**
 * The journal↔applied comparison is the only real logic in `db:check`. Both sides are
 * string-coerced because a Postgres driver may return `created_at` as a string while the
 * journal stores `when` as a number; a coercion bug here would report every migration as
 * pending (or none, on a partial rollback).
 */
describe("findUnappliedMigrations", () => {
  const entries: DrizzleJournalEntry[] = [
    { tag: "0000_init", when: 1_700_000_000_000 },
    { tag: "0001_add_x", when: 1_700_000_100_000 },
    { tag: "0002_add_y", when: 1_700_000_200_000 },
  ];

  it("returns nothing when every journal entry is applied", () => {
    const applied = entries.map((entry, index) => ({ created_at: entry.when, id: index }));
    expect(findUnappliedMigrations(entries, applied)).toEqual([]);
  });

  it("returns the entries that are missing from the applied set", () => {
    const applied = [{ id: 0, created_at: 1_700_000_000_000 }];
    expect(findUnappliedMigrations(entries, applied).map((entry) => entry.tag)).toEqual([
      "0001_add_x",
      "0002_add_y",
    ]);
  });

  it("coerces string created_at values before comparing", () => {
    const applied = entries.map((entry) => ({
      created_at: String(entry.when) as unknown as number,
    }));
    expect(findUnappliedMigrations(entries, applied)).toEqual([]);
  });

  it("reports everything pending when no migrations are applied", () => {
    expect(findUnappliedMigrations(entries, [])).toHaveLength(entries.length);
  });
});
