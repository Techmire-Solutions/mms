import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncFacultyEmployDesignationsTx } from "../db/repositories/facultyEmployDesignationSync.js";

const mockUpsert = vi.fn();

vi.mock("../db/repositories/facultyEmployDesignationRepository.js", () => ({
  upsertFacultyEmployDesignationTx: (...args: unknown[]) => mockUpsert(...args),
}));

describe("syncFacultyEmployDesignationsTx concurrent tenures", () => {
  const updateReturning = vi.fn().mockResolvedValue([]);
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const tx = {
    update: vi.fn(() => ({ set: updateSet })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    updateReturning.mockResolvedValue([]);
    let n = 0;
    mockUpsert.mockImplementation(async () => {
      n += 1;
      return `faced-${n}`;
    });
  });

  it("keeps multiple active open-ended tenures without closing siblings", async () => {
    const primaryId = await syncFacultyEmployDesignationsTx(tx as never, "demo", "emp-1", {
      id: "f1",
      contactId: "c1",
      status: "active",
      employDesignations: [
        {
          designationId: "d1",
          employDesignationStatus: "active",
          designationEndDate: null,
          designationStartDate: "2024-01-01",
        },
        {
          designationId: "d2",
          employDesignationStatus: "active",
          designationEndDate: null,
          designationStartDate: "2024-02-01",
        },
      ],
    } as never);

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(primaryId).toBe("faced-2");
    // Soft-delete omitted rows only — not sibling close-before-upsert.
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate active open designations in one payload", async () => {
    await expect(
      syncFacultyEmployDesignationsTx(tx as never, "demo", "emp-1", {
        id: "f1",
        contactId: "c1",
        status: "active",
        employDesignations: [
          { designationId: "d1", employDesignationStatus: "active", designationEndDate: null },
          { designationId: "d1", employDesignationStatus: "active", designationEndDate: null },
        ],
      } as never),
    ).rejects.toThrow(/Duplicate active open/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
