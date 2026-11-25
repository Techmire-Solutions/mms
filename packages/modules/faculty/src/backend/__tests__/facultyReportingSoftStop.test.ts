import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mms/be-core/audit", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  recordModernAuditEvent: vi.fn().mockResolvedValue({
    hashPrevious: "",
    hashCurrent: "",
    canonicalPayload: "",
  }),
}));

vi.mock("@mms/be-core/data/outbox", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@mms/be-core/datetime", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  workspaceTodayIso: vi.fn().mockResolvedValue("2026-11-17"),
}));

import { persistFacultyTx } from "../repository/db/facultyRepositoryColumns.js";

describe("persistFacultyTx employment profile writes", () => {
  const selectLimit = vi.fn().mockResolvedValue([]);
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const insertOnConflict = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn(() => ({ onConflictDoUpdate: insertOnConflict }));
  const tx = {
    select: vi.fn(() => ({ from: selectFrom })),
    insert: vi.fn(() => ({ values: insertValues })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    selectLimit.mockResolvedValue([]);
  });

  it("persists profile columns without employment/designation mirrors", async () => {
    await persistFacultyTx(tx as never, "demo", {
      id: "f1",
      contactId: "c1",
      status: "active",
      reportingFacultyId: "legacy-sup",
      department: "Legacy Dept",
      designation: "Legacy Title",
      hierarchyRank: 3,
      specialization: "Fiqh",
    } as never);

    expect(tx.insert).toHaveBeenCalled();
    const valueCalls = insertValues.mock.calls as unknown as Array<[Record<string, unknown>]>;
    // Faculty insert is last (employment + employ-designation upserts precede it).
    const facultyValues = valueCalls[valueCalls.length - 1]?.[0] ?? valueCalls[0]?.[0];
    expect(facultyValues).toMatchObject({
      id: "f1",
      specialization: "Fiqh",
    });
    expect(facultyValues).toHaveProperty("employmentId");
    expect(facultyValues).not.toHaveProperty("contactId");
    expect(facultyValues).not.toHaveProperty("status");
    expect(facultyValues).not.toHaveProperty("employeeId");
    expect(facultyValues).not.toHaveProperty("designationId");
    expect(facultyValues).not.toHaveProperty("department");
    expect(facultyValues).not.toHaveProperty("designation");
    expect(facultyValues).not.toHaveProperty("reportingFacultyId");
    expect(facultyValues).not.toHaveProperty("hierarchyRank");
  });
});
