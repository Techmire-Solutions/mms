import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/shared";
import {
  renderFacultyWorkColumnValue,
  type RenderFacultyWorkColumnOptions,
} from "./facultyWorkColumnCell";

const mockTranslate = ((key: string) => key) as never;

const mockFaculty: Faculty = {
  id: "tch-1",
  contactId: "cnt-1",
  name: "Ustadh Umar",
  status: "active",
  specialization: "Tajweed",
  qualification: "Alimiyyah",
  joinDate: "2023-05-15",
  notes: "Senior Quran instructor",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const baseOptions: RenderFacultyWorkColumnOptions = {
  t: mockTranslate,
  statusConfig: { active: { label: "Active", cls: "bg-success/10 text-success" } },
  emptyFallback: "—",
};

describe("renderFacultyWorkColumnValue", () => {
  it("renders status badge for status column", () => {
    const result = renderFacultyWorkColumnValue(mockFaculty, "status", baseOptions);
    const html = renderToStaticMarkup(<div>{result}</div>);

    expect(html).toContain("Active");
  });

  it("renders specialization text", () => {
    const result = renderFacultyWorkColumnValue(mockFaculty, "specialization", baseOptions);

    expect(result).toBe("Tajweed");
  });

  it("renders qualification text", () => {
    const result = renderFacultyWorkColumnValue(mockFaculty, "qualification", baseOptions);

    expect(result).toBe("Alimiyyah");
  });

  it("renders notes text", () => {
    const result = renderFacultyWorkColumnValue(mockFaculty, "notes", baseOptions);

    expect(result).toBe("Senior Quran instructor");
  });

  it("renders employment and designation dates", () => {
    const dated: Faculty = {
      ...mockFaculty,
      employmentStartDate: "2023-05-15",
      employmentEndDate: "2025-01-01",
      designationStartDate: "2024-02-01",
      designationEndDate: "2025-06-30",
      employeeId: "EMP-42",
    };
    expect(renderFacultyWorkColumnValue(dated, "employeeId", baseOptions)).toBe("EMP-42");
    expect(
      String(renderFacultyWorkColumnValue(dated, "employmentStartDate", baseOptions)),
    ).toContain("2023");
    expect(String(renderFacultyWorkColumnValue(dated, "employmentEndDate", baseOptions))).toContain(
      "2025",
    );
    expect(
      String(renderFacultyWorkColumnValue(dated, "designationStartDate", baseOptions)),
    ).toContain("2024");
    expect(
      String(renderFacultyWorkColumnValue(dated, "designationEndDate", baseOptions)),
    ).toContain("2025");
  });

  it("renders employDesignationStatus badge", () => {
    const tenureFaculty: Faculty = {
      ...mockFaculty,
      employDesignationStatus: "active",
    };
    const html = renderToStaticMarkup(
      <div>
        {renderFacultyWorkColumnValue(tenureFaculty, "employDesignationStatus", baseOptions)}
      </div>,
    );
    expect(html).toContain("Active");
  });

  it("renders designation with semantic badge styling", () => {
    const facultyWithDesignation: Faculty = {
      ...mockFaculty,
      designation: "Head of Quranic Studies",
    };
    const result = renderFacultyWorkColumnValue(facultyWithDesignation, "designation", baseOptions);
    const html = renderToStaticMarkup(<div>{result}</div>);

    expect(html).toContain("Head of Quranic Studies");
    expect(html).toContain("bg-primary/10 text-primary");
  });

  it("renders reportingFacultyName and subordinateCount", () => {
    const facultyWithHierarchy: Faculty = {
      ...mockFaculty,
      reportingFacultyName: "Dean Ahmad",
      subordinateCount: 3,
    };
    const supervisorResult = renderFacultyWorkColumnValue(
      facultyWithHierarchy,
      "reportingFacultyName",
      baseOptions,
    );
    const supervisorHtml = renderToStaticMarkup(<div>{supervisorResult}</div>);
    expect(supervisorHtml).toContain("Dean Ahmad");

    const subResult = renderFacultyWorkColumnValue(
      facultyWithHierarchy,
      "subordinateCount",
      baseOptions,
    );
    const subHtml = renderToStaticMarkup(<div>{subResult}</div>);
    expect(subHtml).toContain("3");
  });

  it("returns emptyFallback for empty values", () => {
    const emptyFaculty: Faculty = {
      ...mockFaculty,
      specialization: undefined,
      designation: undefined,
      notes: undefined,
    };
    const result = renderFacultyWorkColumnValue(emptyFaculty, "designation", baseOptions);

    expect(result).toBe("—");
  });

  it("renders custom field value when customFieldsById is provided", () => {
    const customFaculty: Faculty = {
      ...mockFaculty,
      room: "Room 101",
    };
    const customFieldsById = new Map([["room", { id: "room", label: "Classroom" }]]);
    const result = renderFacultyWorkColumnValue(customFaculty, "custom:room", {
      ...baseOptions,
      customFieldsById,
    });

    expect(result).toBe("Room 101");
  });

  it("renders performanceRating with star icon", () => {
    const facultyWithRating = { ...mockFaculty, performanceRating: 4.8 };
    const result = renderFacultyWorkColumnValue(
      facultyWithRating,
      "performanceRating",
      baseOptions,
    );
    const html = renderToStaticMarkup(<div>{result}</div>);

    expect(html).toContain("4.8");
  });

  it("renders assignedClassesCount with badge", () => {
    const facultyWithClasses = { ...mockFaculty, assignedClasses: ["s1", "s2"] };
    const result = renderFacultyWorkColumnValue(
      facultyWithClasses,
      "assignedClassesCount",
      baseOptions,
    );
    const html = renderToStaticMarkup(<div>{result}</div>);

    expect(html).toContain("2");
    expect(html).toContain("faculty.detail.assignedClasses");
  });
});
