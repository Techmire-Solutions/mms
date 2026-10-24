import { describe, expect, it } from "vitest";
import {
  employDesignationRowsFromFaculty,
  employDesignationRowsToWritePayload,
  flatDraftPatchFromEmployDesignationRows,
  newEmployDesignationFormRow,
  pickPrimaryEmployDesignationRow,
} from "../lib/facultyEmployDesignationFormDraft";

describe("facultyEmployDesignationFormDraft", () => {
  it("builds rows from flat faculty mirrors", () => {
    const rows = employDesignationRowsFromFaculty({
      designationId: "lecturer",
      employDesignationId: "faced-1",
      designationStartDate: "2026-01-01",
      employDesignationStatus: "active",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.designationId).toBe("lecturer");
  });

  it("picks open active row as primary", () => {
    const rows = [
      newEmployDesignationFormRow({ designationId: "a", employDesignationStatus: "inactive" }),
      newEmployDesignationFormRow({
        designationId: "b",
        employDesignationStatus: "active",
        designationEndDate: null,
      }),
    ];
    expect(pickPrimaryEmployDesignationRow(rows)?.designationId).toBe("b");
  });

  it("syncs primary mirrors onto flat draft patch", () => {
    const rows = [
      newEmployDesignationFormRow({ designationId: "hod", employDesignationStatus: "active" }),
    ];
    const patch = flatDraftPatchFromEmployDesignationRows(rows);
    expect(patch.designationId).toBe("hod");
    expect(employDesignationRowsToWritePayload(rows)).toHaveLength(1);
  });
});
