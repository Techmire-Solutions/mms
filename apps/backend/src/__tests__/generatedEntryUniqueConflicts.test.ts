import { describe, expect, it } from "vitest";
import { isIdempotentGeneratedEntryConflict } from "../accounting/ledgerPosting/ledgerPostingHelpers.js";

/**
 * Generated postings must swallow only "this exact voucher already exists".
 *
 * The old catch treated every `23505` as an idempotent replay, so a voucher whose
 * ref collided with another entry was dropped from the ledger while the caller
 * reported success. Ref collisions belong to `mapJournalEntryUniqueError` (409).
 */
const pgError = (constraint: string) =>
  Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
    code: "23505",
    constraint,
  });

describe("isIdempotentGeneratedEntryConflict", () => {
  it("treats the source key and the entry primary key as an idempotent replay", () => {
    expect(
      isIdempotentGeneratedEntryConflict(pgError("accounting_entries_workspace_source_uidx")),
    ).toBe(true);
    expect(isIdempotentGeneratedEntryConflict(pgError("accounting_entries_pkey"))).toBe(true);
  });

  it("does not treat a ref collision as a replay (it is a 409 conflict)", () => {
    expect(
      isIdempotentGeneratedEntryConflict(pgError("accounting_entries_workspace_ref_active_uidx")),
    ).toBe(false);
  });

  it("walks the drizzle cause chain and ignores non-unique errors", () => {
    const wrapped = Object.assign(new Error("Failed query"), {
      cause: pgError("accounting_entries_workspace_source_uidx"),
    });
    expect(isIdempotentGeneratedEntryConflict(wrapped)).toBe(true);
    expect(isIdempotentGeneratedEntryConflict(new Error("boom"))).toBe(false);
    expect(isIdempotentGeneratedEntryConflict(null)).toBe(false);
  });
});
