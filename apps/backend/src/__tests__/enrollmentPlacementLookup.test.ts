import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@mms/db/soft-delete", () => ({
  enableIncludeDeleted: vi.fn().mockResolvedValue(undefined),
  withIncludeDeletedScope: vi.fn(async (_tx: unknown, work: () => Promise<unknown>) => work()),
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenantRead: vi.fn(async (_subdomain: string, cb: (tx: unknown) => Promise<unknown>) =>
    cb({ execute: vi.fn().mockResolvedValue({ rows: [] }) }),
  ),
}));

import { enableIncludeDeleted, withIncludeDeletedScope } from "@mms/db/soft-delete";
import {
  listEnrollmentPlacementsAsOfTx,
  listEnrollmentPlacementsForDates,
} from "../db/repositories/enrollmentPlacementLookup.js";

describe("enrollment placement lookup opts into soft-deleted rows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withIncludeDeletedScope).mockImplementation(async (_tx, work) => work());
  });

  it("AsOf lookup wraps its query in withIncludeDeletedScope so trashed enrollments stay visible", async () => {
    const tx = { execute: vi.fn().mockResolvedValue({ rows: [] }) };
    const rows = await listEnrollmentPlacementsAsOfTx(
      tx as never,
      "demo",
      ["c1"],
      ["s1"],
      "2026-09-01",
    );
    expect(withIncludeDeletedScope).toHaveBeenCalledWith(tx, expect.any(Function));
    expect(rows).toEqual([]);
  });

  it("ForDates lookup opts into soft-deleted rows", async () => {
    await listEnrollmentPlacementsForDates("demo", ["c1"], ["s1"], ["2026-09-01"]);
    expect(enableIncludeDeleted).toHaveBeenCalled();
  });
});
