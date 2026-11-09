import { describe, expect, it, vi } from "vitest";
import type pg from "pg";

/** Boot-time analytics indexes: created once, repaired when invalid, never fatal. */

const log = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }));
vi.mock("../lib/logger.js", () => ({ logger: log }));

import { ensureAttendanceAnalyticsIndexes } from "../db/migrations/attendanceAnalyticsIndexes.js";

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

describe("ensureAttendanceAnalyticsIndexes", () => {
  it("creates the three analytics indexes on a fresh database", async () => {
    const { client, statements } = fakeClient();
    await ensureAttendanceAnalyticsIndexes(client);
    expect(created(statements)).toHaveLength(3);
    expect(statements.some((text) => text.includes("INCLUDE"))).toBe(true);
    expect(statements.some((text) => text.includes("from_date"))).toBe(true);
  });

  it("skips valid indexes", async () => {
    const { client, statements } = fakeClient({
      existing: [
        "attendance_workspace_date_status_covering_idx",
        "attendance_workspace_student_date_active_idx",
        "attendance_leaves_workspace_student_approved_idx",
      ],
    });
    await ensureAttendanceAnalyticsIndexes(client);
    expect(created(statements)).toHaveLength(0);
  });

  it("drops and rebuilds an invalid index left by a failed concurrent build", async () => {
    const { client, statements } = fakeClient({
      invalid: ["attendance_workspace_date_status_covering_idx"],
    });
    await ensureAttendanceAnalyticsIndexes(client);
    expect(statements.some((text) => /DROP INDEX CONCURRENTLY/i.test(text))).toBe(true);
    expect(created(statements)).toHaveLength(3);
  });

  it("never throws when a build fails (boot must continue)", async () => {
    const { client } = fakeClient({ createFails: true });
    await expect(ensureAttendanceAnalyticsIndexes(client)).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalled();
  });
});
