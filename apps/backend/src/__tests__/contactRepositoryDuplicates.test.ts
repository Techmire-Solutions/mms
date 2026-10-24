import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("reparentContactReferences executes SQL statements across relationships, students, faculty, users, and message logs", async () => {
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { execute: typeof mockTxExecute }) => Promise<unknown>) =>
        fn({ execute: mockTxExecute }),
    );

    await reparentContactReferences("Demo", "c-keep", "c-delete");

    // 1. delete self-loops
    // 2. delete duplicate tuples (related_contact_id)
    // 2b. delete duplicate tuples (contact_id)
    // 3. update related_contact_id
    // 3b. update contact_id
    // 4. update students
    // 5. update faculty
    // 6. update tenant_users
    // 7. update message_logs
    expect(mockTxExecute).toHaveBeenCalledTimes(9);
  });
});
