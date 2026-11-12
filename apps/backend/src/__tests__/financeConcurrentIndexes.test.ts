import { describe, expect, it, vi } from "vitest";
import type pg from "pg";

/** Finance directory indexes: created once, repaired when invalid, never fatal. */

const log = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }));
vi.mock("../lib/logger.js", () => ({ logger: log }));

import {
  FINANCE_CONCURRENT_INDEXES,
  ensureFinanceConcurrentIndexes,
} from "../db/migrations/financeConcurrentIndexes.js";

function fakeClient(
  options: { existing?: string[]; invalid?: string[]; createFails?: boolean } = {},
) {
  const statements: string[] = [];
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    statements.push(text);
    if (text.includes("pg_advisory")) return { rows: [] };
    if (text.includes("FROM pg_index i")) {
      const name = String(params?.[0] ?? "");
      if (options.invalid?.includes(name)) return { rows: [{ indisvalid: false }] };
      return options.existing?.includes(name) ? { rows: [{ indisvalid: true }] } : { rows: [] };
    }
    if (/CREATE INDEX CONCURRENTLY/i.test(text) && options.createFails) {
      throw new Error("lock timeout");
    }
    return { rows: [] };
  });
  return { client: { query } as unknown as pg.Client, statements };
}

const created = (statements: readonly string[]) =>
  statements.filter((text) => /CREATE INDEX CONCURRENTLY/i.test(text));

describe("ensureFinanceConcurrentIndexes", () => {
  it("creates every directory index on a fresh database", async () => {
    const { client, statements } = fakeClient();
    await ensureFinanceConcurrentIndexes(client);
    expect(created(statements)).toHaveLength(FINANCE_CONCURRENT_INDEXES.length);
    // The two directories order by created_at, and the generated-invoice lookup
    // needs (student, billing period) — all restricted to active rows.
    expect(statements.some((text) => text.includes('"created_at" DESC'))).toBe(true);
    expect(statements.some((text) => text.includes('"billing_period"'))).toBe(true);
    expect(
      statements.every(
        (text) =>
          !text.includes("CREATE INDEX CONCURRENTLY") ||
          text.includes('WHERE "deleted_at" IS NULL'),
      ),
    ).toBe(true);
  });

  it("skips indexes that are already valid", async () => {
    const { client, statements } = fakeClient({
      existing: FINANCE_CONCURRENT_INDEXES.map((spec) => spec.name),
    });
    await ensureFinanceConcurrentIndexes(client);
    expect(created(statements)).toHaveLength(0);
  });

  it("drops and rebuilds an invalid index", async () => {
    const invalidName = FINANCE_CONCURRENT_INDEXES[0].name;
    const { client, statements } = fakeClient({ invalid: [invalidName] });
    await ensureFinanceConcurrentIndexes(client);
    expect(statements.some((text) => text.includes("DROP INDEX CONCURRENTLY"))).toBe(true);
    expect(created(statements)).toHaveLength(FINANCE_CONCURRENT_INDEXES.length);
  });

  it("does not fail the boot when a concurrent build fails", async () => {
    const { client } = fakeClient({ createFails: true });
    await expect(ensureFinanceConcurrentIndexes(client)).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalled();
  });
});
