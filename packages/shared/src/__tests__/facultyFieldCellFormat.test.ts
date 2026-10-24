import { describe, expect, it } from "vitest";
import {
  DEFAULT_FACULTY_STATUS,
  formatFacultyFieldCellValue,
  registerSettingsProvider,
} from "../index.js";

describe("formatFacultyFieldCellValue", () => {
  it("returns undefined for empty values unless status default applies", () => {
    expect(formatFacultyFieldCellValue(undefined)).toBeUndefined();
    expect(formatFacultyFieldCellValue(null)).toBeUndefined();
    expect(formatFacultyFieldCellValue("")).toBeUndefined();
    expect(formatFacultyFieldCellValue("  ")).toBeUndefined();
    expect(formatFacultyFieldCellValue("", { propKey: "status" })).toBe(DEFAULT_FACULTY_STATUS);
    expect(formatFacultyFieldCellValue(undefined, { statusDefault: true })).toBe(
      DEFAULT_FACULTY_STATUS,
    );
  });

  it("formats dates and datetimes by Setup field type", () => {
    // Pin global display format so assertions are locale/timezone independent.
    registerSettingsProvider(() => ({
      dateFormat: "YYYY-MM-DD",
      timezone: "UTC",
      language: "en",
    }));
    try {
      expect(formatFacultyFieldCellValue("2024-01-05", { fieldType: "date" })).toBe("2024-01-05");
      expect(formatFacultyFieldCellValue("2024-01-05T09:30:00Z", { fieldType: "datetime" })).toBe(
        "2024-01-05 9:30",
      );
      expect(formatFacultyFieldCellValue("2024-01-05", {})).toBe("2024-01-05");
      expect(formatFacultyFieldCellValue("2024-01-05T09:30:00Z", {})).toBe("2024-01-05 9:30");
    } finally {
      registerSettingsProvider(null);
    }
  });

  it("renders booleans with optional localized labels", () => {
    expect(formatFacultyFieldCellValue(true)).toBe("true");
    expect(formatFacultyFieldCellValue(false)).toBe("false");
    expect(formatFacultyFieldCellValue(true, { booleanLabels: { yes: "Yes", no: "No" } })).toBe(
      "Yes",
    );
    expect(formatFacultyFieldCellValue(false, { booleanLabels: { yes: "Yes", no: "No" } })).toBe(
      "No",
    );
  });

  it("joins arrays with the requested separator", () => {
    expect(formatFacultyFieldCellValue(["Hifz", "Tajweed"], {})).toBe("Hifz, Tajweed");
    expect(formatFacultyFieldCellValue(["Hifz", "Tajweed"], { arraySeparator: "; " })).toBe(
      "Hifz; Tajweed",
    );
    expect(formatFacultyFieldCellValue([], {})).toBeUndefined();
  });

  it("stringifies scalars and drops objects", () => {
    expect(formatFacultyFieldCellValue(42)).toBe("42");
    expect(formatFacultyFieldCellValue("Hifz")).toBe("Hifz");
    expect(formatFacultyFieldCellValue({ nested: true })).toBeUndefined();
  });
});
