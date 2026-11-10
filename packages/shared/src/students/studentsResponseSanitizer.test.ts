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

  it("masks CNIC when not completely stripped for non-admin viewers", () => {
    // Empty config: cnic is not in setup fields, so it falls to default non-admin masking
    const config = { fields: {}, tabs: [] };
    const s = student({ cnic: "35202-1234567-8" });

    const teacherView = sanitizeStudentForViewer(s, "teacher", config);
    expect(teacherView.cnic).toBe("***-**-67-8");

    const adminView = sanitizeStudentForViewer(s, "admin", config);
    expect(adminView.cnic).toBe("35202-1234567-8");
  });

  it("redacts confidential medical and psychological evaluations for standard teachers", () => {
    const config = { fields: {}, tabs: [] };
    const s = student({
      notes: "Confidential teacher assessment",
      medicalConditions: ["Severe Asthma", "Peanut Allergy"],
      customFields: {
        psychologicalEvaluation: "Restricted ADHD report",
        iepDetails: "Individual Education Plan tier 3",
        bloodGroup: "B+",
      },
    });

    const teacherView = sanitizeStudentForViewer(s, "teacher", config, {
      canViewNotes: true,
      canViewMedical: false,
      canViewIep: false,
    });

    // Notes remain because canViewNotes is true
    expect(teacherView.notes).toBe("Confidential teacher assessment");
    // Detailed medical conditions stripped, replaced with safe boolean alert
    expect(teacherView.medicalConditions).toBeUndefined();
    expect(teacherView.hasMedicalAlert).toBe(true);
    // Confidential IEP & psychological report stripped from customFields
    expect(
      (teacherView.customFields as Record<string, unknown>).psychologicalEvaluation,
    ).toBeUndefined();
    expect((teacherView.customFields as Record<string, unknown>).iepDetails).toBeUndefined();
    // Non-confidential custom field preserved
    expect((teacherView.customFields as Record<string, unknown>).bloodGroup).toBe("B+");
  });

  it("permits full medical and IEP view for authorized roles (nurse / principal)", () => {
    const config = { fields: {}, tabs: [] };
    const s = student({
      medicalConditions: ["Diabetes Type 1"],
      customFields: {
        psychologicalEvaluation: "Restricted evaluation",
      },
    });

    const principalView = sanitizeStudentForViewer(s, "principal", config);
    expect(principalView.medicalConditions).toEqual(["Diabetes Type 1"]);
    expect((principalView.customFields as Record<string, unknown>).psychologicalEvaluation).toBe(
      "Restricted evaluation",
    );
  });
});
