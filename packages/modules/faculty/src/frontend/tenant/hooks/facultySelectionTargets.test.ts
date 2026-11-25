import { describe, expect, it } from "vitest";
import type { Faculty } from "@mms/contracts";
import { computeFacultySelectionTargets } from "./facultySelectionTargets";

function createFaculty(partial: Partial<Faculty> & { id: string }): Faculty {
  return {
    contactId: `c-${partial.id}`,
    status: "active",
    ...partial,
  } as Faculty;
}

describe("computeFacultySelectionTargets", () => {
  it("returns empty buckets when nothing is selected", () => {
    const result = computeFacultySelectionTargets({
      selectedIds: [],
      workFaculty: [createFaculty({ id: "1", phone: "+923001234567" })],
    });
    expect(result).toEqual({ waTargets: [], smsReady: [], emailReady: [] });
  });

  it("filters current-page selected rows by channel eligibility", () => {
    const withPhone = createFaculty({ id: "1", phone: "+923001234567" });
    const withEmail = createFaculty({ id: "2", email: "faculty@example.com" });
    const neither = createFaculty({ id: "3" });
    const result = computeFacultySelectionTargets({
      selectedIds: ["1", "2", "3", "missing"],
      workFaculty: [withPhone, withEmail, neither],
    });

    expect(result.smsReady.map((row) => row.id)).toEqual(["1"]);
    expect(result.waTargets.map((row) => row.id)).toEqual(["1"]);
    expect(result.emailReady.map((row) => row.id)).toEqual(["2"]);
  });

  it("treats a short/landline phone as SMS-ready but not WhatsApp-capable", () => {
    const shortPhone = createFaculty({ id: "4", phone: "123" });
    const result = computeFacultySelectionTargets({
      selectedIds: ["4"],
      workFaculty: [shortPhone],
    });

    expect(result.smsReady.map((row) => row.id)).toEqual(["4"]);
    expect(result.waTargets).toEqual([]);
    expect(result.emailReady).toEqual([]);
  });
});
