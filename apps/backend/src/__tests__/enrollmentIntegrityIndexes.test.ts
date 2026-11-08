import { beforeEach, describe, expect, it, vi } from "vitest";
import type pg from "pg";

const log = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));

vi.mock("../lib/logger.js", () => ({ logger: log }));

import { ensureEnrollmentIntegrityIndexes } from "../db/migrations/enrollmentIntegrityIndexes.js";

interface ClientOptions {
  /** Index names that already exist and are considered valid. */
  existing?: string[];
  /** Duplicates returned for any pre-flight whose SQL contains `marker`. */
  duplicatesWhen?: { marker: string; rows: unknown[] };
  /** Index names reported as built-but-invalid. */
  invalid?: string[];
}

function fakeClient(options: ClientOptions = {}) {
  const statements: string[] = [];
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    statements.push(text);
    if (text.includes("pg_advisory")) return { rows: [] };
    if (text.includes("FROM pg_index i")) {
      const name = String(params?.[0] ?? "");
      if (options.invalid?.includes(name)) return { rows: [{ indisvalid: false }] };
      return options.existing?.includes(name) ? { rows: [{ indisvalid: true }] } : { rows: [] };
    }
    if (text.includes("GROUP BY 1, 2, 3")) {
      const marker = options.duplicatesWhen?.marker;
      if (marker && text.includes(marker)) return { rows: options.duplicatesWhen?.rows ?? [] };
      return { rows: [] };
    }
    return { rows: [] };
  });
  return { client: { query } as unknown as pg.Client, statements };
}

const createStatements = (statements: readonly string[]): string[] =>
  statements.filter((text) => /CREATE (UNIQUE )?INDEX CONCURRENTLY/i.test(text));

describe("ensureEnrollmentIntegrityIndexes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds every missing index concurrently and then releases the advisory lock", async () => {
    const { client, statements } = fakeClient();

    await ensureEnrollmentIntegrityIndexes(client);

    const created = createStatements(statements);
    expect(created).toHaveLength(5);
    expect(created.some((sql) => sql.includes("enrollments_live_student_session_uidx"))).toBe(true);
    expect(statements.at(-1)).toContain("pg_advisory_unlock");
    expect(log.info).toHaveBeenCalled();
  });

  it("skips a valid index instead of rebuilding it", async () => {
    const { client, statements } = fakeClient({
      existing: ["enrollments_live_student_session_uidx"],
    });

    await ensureEnrollmentIntegrityIndexes(client);

    const created = createStatements(statements);
    expect(created).toHaveLength(4);
    expect(created.some((sql) => sql.includes("enrollments_live_student_session_uidx"))).toBe(
      false,
    );
  });

  it("skips (but does not fail) a unique build when existing rows already duplicate", async () => {
    const { client, statements } = fakeClient({
      duplicatesWhen: {
        marker: `"student_id"`,
        rows: [
          {
            workspace_subdomain: "demo",
            session_id: "s1",
            student_id: "stu-1",
            enrollment_ids: ["a", "b"],
          },
        ],
      },
    });

    await expect(ensureEnrollmentIntegrityIndexes(client)).resolves.toBeUndefined();

    const created = createStatements(statements);
    expect(created.some((sql) => sql.includes("enrollments_live_student_session_uidx"))).toBe(
      false,
    );
    // A duplicate on the student/session pair must not block the roll-no or the
    // performance indexes.
    expect(created.some((sql) => sql.includes("enrollments_seat_count_idx"))).toBe(true);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ index: "enrollments_live_student_session_uidx" }),
      expect.stringContaining("Skipping unique enrollment index"),
    );
  });

  it("drops an invalid index before rebuilding it", async () => {
    const { client, statements } = fakeClient({
      invalid: ["enrollments_live_student_session_uidx"],
    });

    await ensureEnrollmentIntegrityIndexes(client);

    expect(statements.some((text) => /DROP INDEX CONCURRENTLY/i.test(text))).toBe(true);
    expect(
      createStatements(statements).some((sql) =>
        sql.includes("enrollments_live_student_session_uidx"),
      ),
    ).toBe(true);
  });
});
