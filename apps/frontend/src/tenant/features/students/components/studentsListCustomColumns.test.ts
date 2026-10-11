import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@mms/shared";
import {
  formatStudentsListContentCustomValue,
  studentCustomFieldKeyFromColumn,
} from "@/tenant/features/students/components/studentsListCustomColumns";

const t = (key: "common.yes" | "common.no" | "students.table.emptyDash"): string => {
  switch (key) {
    case "common.yes":
      return "Yes";
    case "common.no":
      return "No";
    default:
      return "—";
  }
};

describe("formatStudentsListContentCustomValue", () => {
  it("returns null for nullish and blank values", () => {
    expect(formatStudentsListContentCustomValue(null, t)).toBeNull();
    expect(formatStudentsListContentCustomValue(undefined, t)).toBeNull();
    expect(formatStudentsListContentCustomValue("", t)).toBeNull();
    expect(formatStudentsListContentCustomValue("   ", t)).toBeNull();
  });

  it("joins array values with a comma", () => {
    expect(formatStudentsListContentCustomValue(["a", "b"], t)).toBe("a, b");
    expect(formatStudentsListContentCustomValue(["a", ""], t)).toBe("a");
    expect(formatStudentsListContentCustomValue([], t)).toBeNull();
  });

  it("renders booleans via translation", () => {
    expect(formatStudentsListContentCustomValue(true, t)).toBe("Yes");
    expect(formatStudentsListContentCustomValue(false, t)).toBe("No");
  });

  it("formats date/datetime strings via regex detection", () => {
    expect(formatStudentsListContentCustomValue("2020-01-02", t)).toBe(
      formatDate("2020-01-02", true),
    );
    expect(formatStudentsListContentCustomValue("2020-01-02T10:00:00", t)).toBe(
      formatDateTime("2020-01-02T10:00:00", true),
    );
  });

  it("honors an explicit type override", () => {
    expect(formatStudentsListContentCustomValue("2020-01-02", t, "datetime")).toBe(
      formatDateTime("2020-01-02", true),
    );
    expect(formatStudentsListContentCustomValue("plain", t, "text")).toBe("plain");
  });

  it("falls back to String() for other values", () => {
    expect(formatStudentsListContentCustomValue(42, t)).toBe("42");
    expect(formatStudentsListContentCustomValue("hello", t)).toBe("hello");
  });
});

describe("studentCustomFieldKeyFromColumn", () => {
  it("extracts the key from a custom column", () => {
    expect(studentCustomFieldKeyFromColumn("custom:grade")).toBe("grade");
  });

  it("returns null for non-custom columns", () => {
    expect(studentCustomFieldKeyFromColumn("dob")).toBeNull();
    expect(studentCustomFieldKeyFromColumn("custom:")).toBe("");
  });
});
