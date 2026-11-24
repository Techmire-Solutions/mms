import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENROLLMENT_EXPORT_COLUMNS,
  resolveAllEnrollmentExportColumns,
  mergeCustomEnrollmentExportColumns,
  filterEnrollmentExportColumnsForViewer,
  extractEnrollmentCell,
  buildEnrollmentsExportRows,
  type EnrollmentExportColumn,
} from "../enrollments/enrollmentsExportUtils.js";
import type { Enrollment } from "../enrollments/enrollmentsModuleManifest.js";

describe("enrollmentsExportUtils", () => {
  const sampleEnrollment: Enrollment = {
    id: "enr-1",
    studentId: "stu-101",
    studentName: "Ahmad Raza",
    sessionId: "sess-2026",
    sessionName: "Spring 2026 Hifz",
    classId: "cls-1",
    className: "Grade 1 Hifz",
    enrolledDate: "2026-02-15",
    baseFee: 4000,
    discountType: "need_based",
    discountLabel: "Need-based concession",
    discountPct: 25,
    discountAmt: 1000,
    finalFee: 3000,
    status: "confirmed",
    paymentStatus: "paid",
    invoiceId: "inv-999",
    notes: "Approved by principal",
    timeline: [
      { ts: "2026-02-15T10:00:00Z", event: "enrolled", by: "admin" },
      { ts: "2026-02-16T12:00:00Z", event: "payment_received", by: "cashier" },
    ],
    createdAt: "2026-02-15T09:00:00Z",
    updatedAt: "2026-02-16T12:00:00Z",
  };

  it("resolves all columns covering all form tabs and financial details", () => {
    const all = resolveAllEnrollmentExportColumns();
    const ids = all.map((c) => c.id);
    expect(ids).toContain("studentName");
    expect(ids).toContain("studentId");
    expect(ids).toContain("sessionName");
    expect(ids).toContain("sessionId");
    expect(ids).toContain("baseFee");
    expect(ids).toContain("discountType");
    expect(ids).toContain("discountPct");
    expect(ids).toContain("finalFee");
    expect(ids).toContain("invoiceId");
    expect(ids).toContain("timelineSummary");
    expect(ids).toContain("notes");
  });

  it("merges custom columns into the export list", () => {
    const merged = mergeCustomEnrollmentExportColumns(
      [...DEFAULT_ENROLLMENT_EXPORT_COLUMNS],
      [{ id: "customSponsor", label: "Sponsor Name" }],
    );
    expect(merged.some((c) => c.id === "customSponsor")).toBe(true);
  });

  it("filters columns and defaults to all columns when empty", () => {
    const resolved = filterEnrollmentExportColumnsForViewer([]);
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.some((c) => c.id === "studentName")).toBe(true);
  });

  it("extracts cells from all tabs, timeline, and custom fields non-destructively", () => {
    expect(extractEnrollmentCell(sampleEnrollment, "studentName")).toBe("Ahmad Raza");
    expect(extractEnrollmentCell(sampleEnrollment, "studentId")).toBe("stu-101");
    expect(extractEnrollmentCell(sampleEnrollment, "baseFee")).toBe("4000");
    expect(extractEnrollmentCell(sampleEnrollment, "discountPct")).toBe("25");
    expect(extractEnrollmentCell(sampleEnrollment, "finalFee")).toBe("3000");
    expect(extractEnrollmentCell(sampleEnrollment, "invoiceId")).toBe("inv-999");
    expect(extractEnrollmentCell(sampleEnrollment, "timelineCount")).toBe("2");
    expect(extractEnrollmentCell(sampleEnrollment, "timelineSummary")).toContain("enrolled");
    expect(extractEnrollmentCell(sampleEnrollment, "timelineSummary")).toContain(
      "payment_received",
    );
  });

  it("builds CSV export grid correctly", () => {
    const columns: EnrollmentExportColumn[] = [
      { id: "studentName", label: "Student" },
      { id: "finalFee", label: "Fee" },
    ];
    const grid = buildEnrollmentsExportRows([sampleEnrollment], columns);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toEqual(["Student", "Fee"]);
    expect(grid[1]).toEqual(["Ahmad Raza", "3000"]);
  });
});
