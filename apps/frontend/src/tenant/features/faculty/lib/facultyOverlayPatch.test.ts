import { describe, expect, it } from "vitest";
import type { Faculty } from "@mms/shared";
import { patchViewFaculty } from "./facultyOverlayPatch";

const record = {
  id: "fac-1",
  contactId: "cnt-1",
  name: "Sheikh Tariq",
  status: "active",
} as Faculty;

describe("patchViewFaculty", () => {
  it("merges a saved patch into the open drawer record", () => {
    const next = patchViewFaculty(record, "fac-1", {
      leaveDetails: { isOnLeave: true, startDate: "2026-11-04" },
    });

    expect(next?.leaveDetails?.isOnLeave).toBe(true);
    expect(next?.name).toBe("Sheikh Tariq");
  });

  it("ignores a patch for another record", () => {
    expect(patchViewFaculty(record, "fac-other", { status: "inactive" })).toBe(record);
  });

  it("is a no-op when no drawer is open", () => {
    expect(patchViewFaculty(null, "fac-1", { status: "inactive" })).toBeNull();
  });
});
