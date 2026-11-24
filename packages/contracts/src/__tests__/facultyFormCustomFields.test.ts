import { describe, expect, it } from "vitest";
import {
  isFacultySystemFormField,
  listEnabledCustomFacultyFormFields,
  listFacultySystemFormFieldKeys,
  resolveFacultyFieldsMapForColumnSync,
} from "../faculty/facultyFormCustomFields.js";
import { findFacultySeedField } from "../settings/moduleFieldSetupFaculty.js";
import type { FieldDefinition } from "../contacts/contactFieldSchemaTypes.js";

function field(partial: Partial<FieldDefinition> & { key: string }): FieldDefinition {
  return {
    label: partial.key,
    type: "text",
    enabled: true,
    order: 0,
    required: false,
    permissions: [],
    defaultValue: "",
    ...partial,
  };
}

describe("listEnabledCustomFacultyFormFields", () => {
  it("scopes non-seed fields to the requested tab", () => {
    const fields = {
      basic: [field({ key: "specialization", order: 0 }), field({ key: "house", order: 10 })],
      employment: [field({ key: "extraNote", order: 0 })],
    };

    expect(listEnabledCustomFacultyFormFields(fields, "basic").map((f) => f.key)).toEqual([
      "house",
    ]);
    expect(listEnabledCustomFacultyFormFields(fields, "employment").map((f) => f.key)).toEqual([
      "extraNote",
    ]);
  });

  it("excludes disabled and system seed keys", () => {
    const fields = {
      employment: [
        field({ key: "status" }),
        field({ key: "hiddenCustom", enabled: false }),
        field({ key: "visibleCustom", enabled: true }),
      ],
    };

    expect(listEnabledCustomFacultyFormFields(fields, "employment").map((f) => f.key)).toEqual([
      "visibleCustom",
    ]);
    expect(listFacultySystemFormFieldKeys().has("status")).toBe(true);
    expect(listFacultySystemFormFieldKeys().has("contactId")).toBe(true);
    expect(isFacultySystemFormField("basic", "specialization")).toBe(true);
    expect(isFacultySystemFormField("employment", "employmentStartDate")).toBe(true);
    expect(isFacultySystemFormField("designation", "designationId")).toBe(true);
  });

  it("aggregates all tabs when tabId is omitted", () => {
    const fields = {
      basic: [field({ key: "onBasic", order: 2 })],
      employment: [field({ key: "onEmployment", order: 1 })],
    };

    expect(listEnabledCustomFacultyFormFields(fields).map((f) => f.key)).toEqual([
      "onEmployment",
      "onBasic",
    ]);
  });
});

describe("findFacultySeedField", () => {
  it("finds a seeded faculty field across any tab", () => {
    expect(findFacultySeedField("contactId")?.key).toBe("contactId");
    expect(findFacultySeedField("employeeId")?.key).toBe("employeeId");
    expect(findFacultySeedField("status")?.labelKey).toBe("faculty.field.status");
  });

  it("returns undefined for unknown fields", () => {
    expect(findFacultySeedField("house")).toBeUndefined();
  });
});

describe("resolveFacultyFieldsMapForColumnSync product locks", () => {
  it("forces contact required on Contacts card and retires specialization/hierarchy fields", () => {
    const fields = resolveFacultyFieldsMapForColumnSync({
      employment: [
        field({ key: "contactId", enabled: false, required: false }),
        field({ key: "specialization", enabled: true, required: true }),
      ],
      hierarchy: [
        field({ key: "hierarchyRank", enabled: true, required: true }),
        field({ key: "reportingFacultyId", enabled: true, required: true }),
      ],
    });
    expect(fields.basic.find((f) => f.key === "contactId")).toMatchObject({
      enabled: true,
      required: true,
    });
    expect(fields.employment.find((f) => f.key === "contactId")).toBeUndefined();
    expect(fields.designation.find((f) => f.key === "employDesignationStatus")).toMatchObject({
      enabled: true,
      required: true,
    });
    expect(fields.basic.find((f) => f.key === "specialization")).toMatchObject({
      enabled: false,
      required: false,
    });
    expect(fields.hierarchy.find((f) => f.key === "hierarchyRank")).toMatchObject({
      enabled: false,
      required: false,
    });
  });

  it("given a legacy stored config, should drop department/designation aliases and lock designationId on", () => {
    const stored = {
      designation: [
        field({ key: "designation", enabled: true, required: false }),
        field({ key: "department", enabled: true, required: true }),
        field({ key: "designationId", enabled: false, required: false }),
        field({ key: "departmentId", enabled: false, required: false }),
      ],
    };

    const fields = resolveFacultyFieldsMapForColumnSync(stored);

    expect(fields.designation.map((f) => f.key)).toEqual([
      "designationId",
      "designationStartDate",
      "designationEndDate",
      "employDesignationStatus",
    ]);
    expect(fields.designation[0]).toMatchObject({ enabled: true, required: true });
    expect(listEnabledCustomFacultyFormFields(fields)).toEqual([]);
  });

  it("given a legacy joinDate flag, should remap it onto employmentStartDate and backfill new seed fields", () => {
    const stored = {
      employment: [
        field({ key: "employeeId", enabled: false, required: false }),
        field({ key: "joinDate", enabled: false, required: false, order: 7 }),
      ],
    };

    const fields = resolveFacultyFieldsMapForColumnSync(stored);
    const keys = fields.employment.map((f) => f.key);

    expect(keys).not.toContain("joinDate");
    expect(fields.employment.find((f) => f.key === "employmentStartDate")).toMatchObject({
      enabled: false,
      required: false,
      order: 7,
      labelKey: "faculty.field.employmentStartDate",
    });
    expect(keys).toEqual(expect.arrayContaining(["employmentEndDate", "status", "employeeId"]));
    expect(keys).not.toContain("contactId");
    expect(fields.basic.find((f) => f.key === "contactId")).toMatchObject({
      enabled: true,
      required: true,
    });
    expect(fields.designation.find((f) => f.key === "employDesignationStatus")).toMatchObject({
      enabled: true,
      required: true,
    });
  });
});
