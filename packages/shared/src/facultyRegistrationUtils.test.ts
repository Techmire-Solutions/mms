import { describe, expect, it } from "vitest";
import {
  computeNextFacultyEmployeeIdFromCount,
  findFacultyRegistrationConflict,
  formatFacultyEmployeeId,
} from "./facultyRegistrationUtils.js";

describe("formatFacultyEmployeeId", () => {
  it("formats with default template and prefix", () => {
    const fixedDate = new Date("2026-09-17T12:00:00Z");
    expect(formatFacultyEmployeeId(1, { idPrefix: "TCH" }, fixedDate)).toBe("TCH20260001");
    expect(formatFacultyEmployeeId(42, { idPrefix: "EMP" }, fixedDate)).toBe("EMP20260042");
  });

  it("formats with custom template with {PREFIX}, {YYYY}, {SEQ}", () => {
    const fixedDate = new Date("2026-09-17T12:00:00Z");
    expect(
      formatFacultyEmployeeId(
        7,
        { idPrefix: "EMP", idTemplate: "{PREFIX}-{YYYY}-{SEQ}", idDigits: 3 },
        fixedDate,
      ),
    ).toBe("EMP-2026-007");
  });

  it("supports {YY} and {MM} tokens", () => {
    const fixedDate = new Date("2026-09-17T12:00:00Z");
    expect(
      formatFacultyEmployeeId(
        15,
        { idPrefix: "FAC", idTemplate: "{PREFIX}/{YY}{MM}/{SEQ}", idDigits: 4 },
        fixedDate,
      ),
    ).toBe("FAC/2609/0015");
  });

  it("safely appends -{SEQ} if template omits sequence token", () => {
    expect(formatFacultyEmployeeId(5, { idPrefix: "TCH", idTemplate: "MADRASA-STAFF" })).toBe(
      "MADRASA-STAFF-0005",
    );
  });

  it("clamps digits between 1 and 8", () => {
    const fixedDate = new Date("2026-09-17T12:00:00Z");
    expect(formatFacultyEmployeeId(1, { idPrefix: "T", idDigits: 1 }, fixedDate)).toBe("T20261");
    expect(formatFacultyEmployeeId(1, { idPrefix: "T", idDigits: 6 }, fixedDate)).toBe(
      "T2026000001",
    );
  });
});

describe("computeNextFacultyEmployeeIdFromCount", () => {
  const fixedDate = new Date("2026-09-17T12:00:00Z");

  it("pads sequence from count", () => {
    expect(computeNextFacultyEmployeeIdFromCount(0, { idPrefix: "TCH" }, fixedDate)).toBe(
      "TCH20260001",
    );
    expect(computeNextFacultyEmployeeIdFromCount(3, { idPrefix: "FAC" }, fixedDate)).toBe(
      "FAC20260004",
    );
  });

  it("respects idStartSeq when count is lower", () => {
    expect(
      computeNextFacultyEmployeeIdFromCount(0, { idPrefix: "EMP", idStartSeq: 100 }, fixedDate),
    ).toBe("EMP20260100");
    expect(
      computeNextFacultyEmployeeIdFromCount(5, { idPrefix: "EMP", idStartSeq: 100 }, fixedDate),
    ).toBe("EMP20260100");
    expect(
      computeNextFacultyEmployeeIdFromCount(120, { idPrefix: "EMP", idStartSeq: 100 }, fixedDate),
    ).toBe("EMP20260121");
  });
});

describe("findFacultyRegistrationConflict", () => {
  const roster = [{ id: "t1", contactId: 10, employeeId: "TCH-0001" }];

  it("detects contact conflict", () => {
    expect(findFacultyRegistrationConflict(roster, { contactId: 10 })).toBe("contact");
  });

  it("skips excluded id", () => {
    expect(findFacultyRegistrationConflict(roster, { excludeId: "t1", contactId: 10 })).toBeNull();
  });

  it("detects employeeId conflict (case-insensitive, trimmed)", () => {
    expect(findFacultyRegistrationConflict(roster, { employeeId: "tch-0001 " })).toBe("employeeId");
    expect(
      findFacultyRegistrationConflict(roster, {
        excludeId: "t1",
        employeeId: "TCH-0001",
      }),
    ).toBeNull();
  });

  it("prioritises contact over employeeId", () => {
    const conflicted = [{ id: "t1", contactId: 10, employeeId: "TCH-0002" }];
    expect(
      findFacultyRegistrationConflict(conflicted, { contactId: 10, employeeId: "TCH-0002" }),
    ).toBe("contact");
  });

  it("returns null when no conflict", () => {
    expect(
      findFacultyRegistrationConflict(roster, { contactId: 11, employeeId: "TCH-0099" }),
    ).toBeNull();
  });

  it("ignores soft-deleted rows", () => {
    const withDeleted = [
      { id: "t1", contactId: 10, employeeId: "TCH-0001", deletedAt: "2026-07-01T00:00:00.000Z" },
    ];
    expect(findFacultyRegistrationConflict(withDeleted, { contactId: 10 })).toBeNull();
    expect(findFacultyRegistrationConflict(withDeleted, { employeeId: "TCH-0001" })).toBeNull();
  });
});
