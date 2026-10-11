import { describe, expect, it, vi } from "vitest";
import type { Student } from "@mms/shared";
import { syncBulkStudentEnrolledSessionsTx } from "../db/repositories/studentRepositoryBulkEnrollSync.js";
import type { AppDb } from "../db/tenant-context.js";

describe("syncBulkStudentEnrolledSessionsTx", () => {
  it("skips delete and insert when existing enrolled sessions match across all batch students", async () => {
    const deleteFn = vi.fn();
    const insertFn = vi.fn();

    const fakeTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { studentId: "s1", sessionId: "sess-1" },
            { studentId: "s2", sessionId: "sess-2" },
          ]),
        }),
      }),
      delete: deleteFn,
      insert: insertFn,
    };

    const items: Student[] = [
      { id: "s1", contactId: "c1", enrolledSessions: ["sess-1"] },
      { id: "s2", contactId: "c2", enrolledSessions: ["sess-2"] },
    ];

    await syncBulkStudentEnrolledSessionsTx(fakeTx as unknown as AppDb, "demo", items);

    expect(deleteFn).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("deletes and re-inserts only for students whose sessions actually changed", async () => {
    const deleteWhere = vi.fn().mockResolvedValue([]);
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });
    const insertValues = vi.fn().mockResolvedValue([]);
    const insertFn = vi.fn().mockReturnValue({ values: insertValues });

    const fakeTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { studentId: "s1", sessionId: "sess-1" },
            { studentId: "s2", sessionId: "sess-old" },
          ]),
        }),
      }),
      delete: deleteFn,
      insert: insertFn,
    };

    const items: Student[] = [
      { id: "s1", contactId: "c1", enrolledSessions: ["sess-1"] }, // unchanged
      { id: "s2", contactId: "c2", enrolledSessions: ["sess-new"] }, // changed
    ];

    await syncBulkStudentEnrolledSessionsTx(fakeTx as unknown as AppDb, "demo", items);

    expect(deleteFn).toHaveBeenCalled();
    expect(insertFn).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: "s2",
          sessionId: "sess-new",
        }),
      ]),
    );
  });

  it("no-ops when items have no enrolledSessions defined", async () => {
    const selectFn = vi.fn();
    const fakeTx = { select: selectFn };

    await syncBulkStudentEnrolledSessionsTx(fakeTx as unknown as AppDb, "demo", [
      { id: "s1", contactId: "c1" },
    ]);

    expect(selectFn).not.toHaveBeenCalled();
  });
});
