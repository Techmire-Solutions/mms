import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

const mockWithTenantTransaction = vi.fn();
const mockTxExecute = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
  // Read paths now go through withTenantRead (read replica + read-only tx).
  withTenantRead: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

function createSelectMock(rows: Array<{ id: string }>) {
  const where = vi.fn(async () => rows);
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select, from, where };
}

/** Flattens a Drizzle SQL tree into readable text (fragments + bound values). */
function collectSqlText(value: unknown, parts: string[] = []): string {
  if (value == null) return parts.join(" ");
  if (typeof value === "string") {
    parts.push(value);
    return parts.join(" ");
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectSqlText(entry, parts);
    return parts.join(" ");
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.queryChunks)) {
    collectSqlText(record.queryChunks, parts);
    return parts.join(" ");
  }
  if (Array.isArray(record.value)) {
    parts.push((record.value as unknown[]).map((entry) => String(entry)).join(""));
    return parts.join(" ");
  }
  if (typeof record.value === "string") {
    parts.push(record.value);
    return parts.join(" ");
  }
  if (typeof record.name === "string") {
    parts.push(record.name);
    return parts.join(" ");
  }
  return parts.join(" ");
}

/** SQL table names referenced by a Drizzle statement (via the drizzle table symbol). */
function collectTableNames(value: unknown, names: string[] = []): string[] {
  if (!value || typeof value !== "object") return names;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.queryChunks)) {
    for (const chunk of record.queryChunks) collectTableNames(chunk, names);
    return names;
  }
  try {
    const name = getTableName(value as never);
    if (typeof name === "string" && name) names.push(name);
  } catch {
    // Not a Drizzle table.
  }
  return names;
}

import {
  findContactDuplicateBlockedIds,
  findContactDuplicateCandidateIds,
  reparentContactReferences,
} from "../db/repositories/contactRepositoryDuplicates.js";

describe("contactRepositoryDuplicates (SQL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTxExecute.mockResolvedValue({ rows: [] });
  });

  it("findContactDuplicateBlockedIds executes the blocking query and maps ids", async () => {
    mockTxExecute.mockResolvedValue({ rows: [{ id: "a" }, { id: "b" }] });
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { execute: typeof mockTxExecute }) => Promise<unknown>) =>
        fn({ execute: mockTxExecute }),
    );

    const ids = await findContactDuplicateBlockedIds("Demo", ["syed", "syeda"]);

    expect(ids).toEqual(["a", "b"]);
    expect(mockTxExecute).toHaveBeenCalledTimes(1);
    // Key spaces are namespaced: a name that textually matches another
    // contact's phone digits must not land in the same duplicate bucket.
    const queryText = collectSqlText(mockTxExecute.mock.calls[0]?.[0]).toUpperCase();
    expect(queryText).toContain("'P:'");
    expect(queryText).toContain("'E:'");
    expect(queryText).toContain("'C:'");
    expect(queryText).toContain("'N:'");
  });

  it("findContactDuplicateBlockedIds returns empty when the query yields no rows", async () => {
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { execute: typeof mockTxExecute }) => Promise<unknown>) =>
        fn({ execute: mockTxExecute }),
    );

    const ids = await findContactDuplicateBlockedIds("Demo", ["syed"]);

    expect(ids).toEqual([]);
    expect(mockTxExecute).toHaveBeenCalledTimes(1);
  });

  it("findContactDuplicateCandidateIds short-circuits when no keys are provided", async () => {
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { execute: typeof mockTxExecute }) => Promise<unknown>) =>
        fn({ execute: mockTxExecute }),
    );

    const ids = await findContactDuplicateCandidateIds("Demo", {
      phones: [],
      emails: [],
      name: "",
      namePrefixes: [],
    });

    expect(ids).toEqual([]);
    expect(mockTxExecute).not.toHaveBeenCalled();
  });

  it("findContactDuplicateCandidateIds returns empty when only an invalid-length cnic is provided without erroring", async () => {
    const ids = await findContactDuplicateCandidateIds("Demo", {
      phones: [],
      emails: [],
      name: "",
      cnic: "12345",
      namePrefixes: [],
    });

    expect(ids).toEqual([]);
    expect(mockWithTenantTransaction).not.toHaveBeenCalled();
  });

  it("findContactDuplicateCandidateIds selects matching ids through the tenant transaction", async () => {
    const { select } = createSelectMock([{ id: "peer-1" }, { id: "peer-2" }]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { select: typeof select }) => Promise<unknown>) =>
        fn({ select }),
    );

    const ids = await findContactDuplicateCandidateIds(
      "Demo",
      { phones: ["3001234567"], emails: ["a@b.com"], name: "ahmed", namePrefixes: ["syed"] },
      ["c1"],
    );

    expect(ids).toEqual(["peer-1", "peer-2"]);
    expect(mockTxExecute).not.toHaveBeenCalled();
  });

  it("reparentContactReferences covers the whole contact FK graph and never the dropped faculty mirror", async () => {
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { execute: typeof mockTxExecute }) => Promise<unknown>) =>
        fn({ execute: mockTxExecute }),
    );

    await reparentContactReferences("Demo", "c-keep", "c-delete", "u-admin");

    const statements = mockTxExecute.mock.calls.map(([statement]) => collectSqlText(statement));
    const tables = new Set(
      mockTxExecute.mock.calls.flatMap(([statement]) => collectTableNames(statement)),
    );
    // 1. delete self-loops
    // 2. delete duplicate relationship tuples (related_contact_id)
    // 3. delete duplicate relationship tuples (contact_id)
    // 4. update related_contact_id
    // 5. update contact_id
    // 6. update students (contact/parent/guardian)
    // 7. archive the loser's conflicting faculty employment
    // 8. re-point faculty_employments
    // 9. de-duplicate workshop registrations
    // 10. re-point workshop_participants
    // 11. re-point finance_invoices.family_contact_id
    // 12. update tenant_users
    // 13. update message_logs
    expect(statements).toHaveLength(13);

    // `faculty.contact_id` was dropped by migration 0160 — referencing it makes
    // every merge fail with 42703 (R4-01).
    expect(tables.has("faculty")).toBe(false);
    expect(tables.has("faculty_employments")).toBe(true);
    expect(tables.has("workshop_participants")).toBe(true);
    expect(tables.has("finance_invoices")).toBe(true);
    expect(tables.has("students")).toBe(true);
    expect(tables.has("tenant_users")).toBe(true);
    expect(tables.has("message_logs")).toBe(true);
  });
});
