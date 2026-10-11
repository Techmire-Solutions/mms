import { describe, expect, it } from "vitest";
import {
  DEFAULT_FACULTY_COLUMN_REGISTRY,
  DEFAULT_FACULTY_EXPORT_COLUMNS,
  FACULTY_COLUMN_FIELD_MAPPING,
  FACULTY_DIRECTORY_COLUMN_SURFACES,
  FACULTY_SORT_FIELDS,
  FACULTY_SORT_FIELD_SET,
  FACULTY_WORK_COLUMN_KEYS,
  facultyColumnLabelKey,
  facultyFieldLabelKey,
  facultyWorkColumnLabelsFrom,
} from "./facultyDirectoryColumns.js";
import { customFieldKeyFromColumnKey } from "./moduleColumnCore.js";

describe("FACULTY_DIRECTORY_COLUMN_SURFACES", () => {
  it("derives sortable work keys as a subset of sort keys", () => {
    const sortByKey = new Map(
      FACULTY_DIRECTORY_COLUMN_SURFACES.map((surface) => [surface.key, surface.sort]),
    );
    for (const workKey of FACULTY_WORK_COLUMN_KEYS) {
      if (sortByKey.get(workKey) === false) continue;
      expect(FACULTY_SORT_FIELD_SET.has(workKey)).toBe(true);
    }
    expect(FACULTY_SORT_FIELDS).toContain("name");
    expect(FACULTY_SORT_FIELDS).toContain("employeeId");
    expect(FACULTY_SORT_FIELDS).toContain("designationEndDate");
    expect(FACULTY_SORT_FIELDS).toContain("updatedAt");
    expect(FACULTY_SORT_FIELD_SET.has("notes")).toBe(false);
  });

  it("builds default Work registry as name + work keys in workOrder", () => {
    expect(DEFAULT_FACULTY_COLUMN_REGISTRY.map((col) => col.key)).toEqual([
      "name",
      ...FACULTY_WORK_COLUMN_KEYS,
    ]);
  });

  it("maps every work column (except name) for Setup field sync", () => {
    for (const workKey of FACULTY_WORK_COLUMN_KEYS) {
      expect(FACULTY_COLUMN_FIELD_MAPPING[workKey]).toEqual(
        expect.objectContaining({ tabId: expect.any(String), fieldId: expect.any(String) }),
      );
    }
  });

  it("derives export columns from export-flagged surfaces in exportOrder", () => {
    expect(DEFAULT_FACULTY_EXPORT_COLUMNS.map((col) => col.id)).toEqual([
      "name",
      "employeeId",
      "designation",
      "department",
      "reportingFacultyName",
      "specialization",
      "employDesignationStatus",
      "status",
      "profileStatus",
      "qualification",
      "designationStartDate",
      "designationEndDate",
      "employmentStartDate",
      "employmentEndDate",
      "performanceRating",
      "notes",
    ]);
    expect(
      FACULTY_DIRECTORY_COLUMN_SURFACES.filter((surface) => surface.export)
        .map((s) => s.key)
        .sort(),
    ).toEqual([...DEFAULT_FACULTY_EXPORT_COLUMNS.map((col) => col.id)].sort());
  });

  it("resolves a column label key from the surface table", () => {
    expect(facultyColumnLabelKey("name")).toBe("faculty.field.name");
    expect(facultyColumnLabelKey("employeeId")).toBe("faculty.field.employeeId");
    expect(facultyColumnLabelKey("designation")).toBe("faculty.field.designation");
    expect(facultyColumnLabelKey("status")).toBe("faculty.field.status");
    expect(facultyColumnLabelKey("specialization")).toBe("faculty.field.specialization");
    expect(facultyColumnLabelKey("qualification")).toBe("faculty.field.qualification");
    expect(facultyColumnLabelKey("designationEndDate")).toBe("faculty.field.designationEndDate");
    expect(facultyColumnLabelKey("notes")).toBe("faculty.field.notes");
    expect(facultyColumnLabelKey("joinDate")).toBe("faculty.field.joinDate");
    expect(facultyColumnLabelKey("updatedAt")).toBe("faculty.field.updatedAt");
  });

  it("falls back to facultyFieldLabelKey when column key is not in surface table", () => {
    expect(facultyColumnLabelKey("joinDate")).toBe("faculty.field.joinDate");
    expect(facultyColumnLabelKey("custom:cert")).toBe("faculty.field.custom:cert");
  });

  it("formats custom field keys via customFieldKeyFromColumnKey", () => {
    expect(customFieldKeyFromColumnKey("custom:licenseNumber")).toBe("licenseNumber");
    expect(customFieldKeyFromColumnKey("name")).toBeNull();
    expect(customFieldKeyFromColumnKey("employeeId")).toBeNull();
  });

  it("builds translated Work column labels from resolver", () => {
    const labels = facultyWorkColumnLabelsFrom((key) => `LABEL_${key.toUpperCase()}`);
    expect(labels).toEqual({
      name: "LABEL_NAME",
      employeeId: "LABEL_EMPLOYEEID",
      designation: "LABEL_DESIGNATION",
      department: "LABEL_DEPARTMENT",
      employDesignationStatus: "LABEL_EMPLOYDESIGNATIONSTATUS",
      designationStartDate: "LABEL_DESIGNATIONSTARTDATE",
      designationEndDate: "LABEL_DESIGNATIONENDDATE",
      status: "LABEL_STATUS",
      employmentStartDate: "LABEL_EMPLOYMENTSTARTDATE",
      employmentEndDate: "LABEL_EMPLOYMENTENDDATE",
      specialization: "LABEL_SPECIALIZATION",
      qualification: "LABEL_QUALIFICATION",
      notes: "LABEL_NOTES",
      performanceRating: "LABEL_PERFORMANCERATING",
    });
  });

  it("formats fallback field label keys", () => {
    expect(facultyFieldLabelKey("customField")).toBe("faculty.field.customField");
  });
});
