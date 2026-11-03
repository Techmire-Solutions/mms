import { describe, expect, it } from "vitest";
import type { FieldDefinition, TabDefinition } from "../contacts/contactTypes.js";
import type { Student } from "./studentTypes.js";
import {
  resolveStudentKeysToStripForViewer,
  sanitizeStudentForViewer,
  sanitizeStudentsForViewer,
} from "./studentsResponseSanitizer.js";

const basicTab: TabDefinition = { key: "basic", label: "Basic", enabled: true, order: 0 };

const restrictedCnic: FieldDefinition = {
  key: "cnic",
  label: "CNIC",
  type: "text",
  enabled: true,
  order: 0,
  permissions: ["admin"],
};

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: "s-1",
    contactId: "c-1",
    name: "Ali Khan",
    grNumber: "GR-26001",
    status: "active",
    cnic: "35202-1234567-1",
    customFields: { cnic: "35202-1234567-1", bloodGroup: "O+" },
    ...overrides,
  } as Student;
}

describe("studentsResponseSanitizer", () => {
  it("strips a role-restricted field for a role that may not read it", () => {
    const config = { fields: { basic: [restrictedCnic] }, tabs: [basicTab] };

    expect(resolveStudentKeysToStripForViewer("teacher", config)).toEqual(["cnic"]);
    expect(sanitizeStudentForViewer(student(), "teacher", config).cnic).toBeUndefined();
    expect(sanitizeStudentForViewer(student(), "admin", config).cnic).toBe("35202-1234567-1");
  });

  it("also strips the restricted value from the nested customFields map", () => {
    const config = { fields: { basic: [restrictedCnic] }, tabs: [basicTab] };

    const sanitized = sanitizeStudentForViewer(student(), "teacher", config);

    // Reads flatten custom_fields onto the record but keep the map, so deleting only the top-level
    // key would still leak the same value under `customFields`.
    expect(sanitized.customFields).toEqual({ bloodGroup: "O+" });
    expect((sanitized as { cnic?: string }).cnic).toBeUndefined();
  });

  it("keeps unregistered custom values and always-visible identity", () => {
    const config = { fields: { basic: [restrictedCnic] }, tabs: [basicTab] };

    const sanitized = sanitizeStudentForViewer(student(), "teacher", config);

    expect(sanitized.id).toBe("s-1");
    expect(sanitized.name).toBe("Ali Khan");
    expect(sanitized.grNumber).toBe("GR-26001");
    expect((sanitized.customFields as Record<string, unknown>).bloodGroup).toBe("O+");
  });

  it("sanitizes every row in a batch and leaves the input untouched", () => {
    const config = { fields: { basic: [restrictedCnic] }, tabs: [basicTab] };
    const rows = [student(), student({ id: "s-2" })];

    const sanitized = sanitizeStudentsForViewer(rows, "teacher", config);

    expect(sanitized.every((row) => row.cnic === undefined)).toBe(true);
    expect(
      sanitized.every(
        (row) =>
          (row as { customFields?: Record<string, unknown> }).customFields?.cnic === undefined,
      ),
    ).toBe(true);
    expect(rows[0]?.cnic).toBe("35202-1234567-1");
  });
});
