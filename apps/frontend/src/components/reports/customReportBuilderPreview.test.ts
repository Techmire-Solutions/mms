import { describe, expect, it } from "vitest";
import {
  buildCustomReportPreviewRows,
  type PreviewCollections,
} from "./customReportBuilderPreview";
import { toCamelCase } from "./customReportBuilderExtractor";

describe("customReportBuilderPreview", () => {
  it("converts field names to camelCase", () => {
    expect(toCamelCase("Student Name")).toBe("studentName");
    expect(toCamelCase("Registration Date")).toBe("registrationDate");
    expect(toCamelCase("Fee Amount")).toBe("feeAmount");
  });

  const mockCollections: PreviewCollections = {
    contacts: [],
    students: [
      { id: "1", name: "Ali Raza", status: "active", class: "Grade 1" },
      { id: "2", name: "Fatima Zahra", status: "active", class: "Grade 2" },
      { id: "3", name: "Zainab Noor", status: "inactive", class: "Grade 1" },
    ],
    sessions: [],
    financial: [],
    attendance: [],
    hasanat: [],
    academic: [],
  };

  it("builds flat preview rows without grouping", () => {
    const rows = buildCustomReportPreviewRows({
      source: "students",
      selectedFields: ["Name", "Status", "Class"],
      aggregate: "None",
      groupBy: "",
      collections: mockCollections,
      currencyCode: "USD",
      translate: (key) => key,
      resolveFieldLabel: (f) => f,
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ Name: "Ali Raza", Status: "active", Class: "Grade 1" });
    expect(rows[1]).toEqual({ Name: "Fatima Zahra", Status: "active", Class: "Grade 2" });
  });

  it("aggregates rows with Count by Class", () => {
    const rows = buildCustomReportPreviewRows({
      source: "students",
      selectedFields: ["Class", "Name"],
      aggregate: "Count",
      groupBy: "Class",
      collections: mockCollections,
      currencyCode: "USD",
      translate: (key) => key,
      resolveFieldLabel: (f) => f,
    });

    expect(rows).toHaveLength(2);
    const grade1 = rows.find((r) => r.Class === "Grade 1");
    const grade2 = rows.find((r) => r.Class === "Grade 2");
    expect(grade1?.Name).toBe(2);
    expect(grade2?.Name).toBe(1);
  });
});
