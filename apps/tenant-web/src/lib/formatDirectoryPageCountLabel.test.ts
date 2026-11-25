import { describe, expect, it } from "vitest";
import { formatDirectoryPageCountLabel } from "@mms/fe-core/tenant/formatDirectoryPageCountLabel";

const t = (key: string): string => {
  const labels: Record<string, string> = {
    "faculty.form.faculty": "faculty member",
    "faculty.table.faculty": "faculty members",
    "students.form.student": "student",
    "students.table.students": "students",
    "contacts.form.contact": "contact",
    "contacts.table.contacts": "contacts",
  };
  return labels[key] ?? key;
};

describe("formatDirectoryPageCountLabel", () => {
  const keys = {
    singular: "faculty.form.faculty",
    plural: "faculty.table.faculty",
  } as const;

  it("uses the singular label for one item", () => {
    expect(formatDirectoryPageCountLabel(1, t, keys)).toBe("1 faculty member");
  });

  it("uses the plural label for multiple items", () => {
    expect(formatDirectoryPageCountLabel(0, t, keys)).toBe("0 faculty members");
    expect(formatDirectoryPageCountLabel(2, t, keys)).toBe("2 faculty members");
  });

  it("keeps the module translation key parity across person modules", () => {
    expect(
      formatDirectoryPageCountLabel(1, t, {
        singular: "students.form.student",
        plural: "students.table.students",
      }),
    ).toBe("1 student");
    expect(
      formatDirectoryPageCountLabel(3, t, {
        singular: "contacts.form.contact",
        plural: "contacts.table.contacts",
      }),
    ).toBe("3 contacts");
  });
});
