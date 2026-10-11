import { describe, expect, it } from "vitest";
import { syncModuleColumnRegistryWithFields } from "./moduleColumnRegistrySync.js";
import { DEFAULT_COLUMN_REGISTRY, COLUMN_FIELD_MAPPING } from "./contactTabRegistry.js";
import { CONTACT_LOCKED_ENABLED_TABS } from "./contactEnabledTabs.js";
import {
  DEFAULT_STUDENT_COLUMN_REGISTRY,
  STUDENT_COLUMN_FIELD_MAPPING,
} from "./moduleFieldSetupPersons.js";
import { listEnabledCustomStudentFormFields } from "./studentFormCustomFields.js";
import type { FieldDefinition } from "./contactTypes.js";

const studentBaseFields: Record<string, FieldDefinition[]> = {
  basic: [
    { key: "contactId", label: "Contact", type: "text", enabled: true, order: 0 },
    { key: "gender", label: "Gender", type: "select", enabled: true, order: 1 },
    { key: "dob", label: "DOB", type: "date", enabled: true, order: 2 },
    { key: "contactRelationships", label: "Parents", type: "text", enabled: true, order: 3 },
  ],
  registration: [
    { key: "grNumber", label: "GR", type: "text", enabled: true, order: 0 },
    { key: "status", label: "Status", type: "select", enabled: true, order: 1 },
    { key: "registeredDate", label: "Registered", type: "date", enabled: true, order: 2 },
    { key: "notes", label: "Notes", type: "textarea", enabled: true, order: 3 },
  ],
};

describe("syncModuleColumnRegistryWithFields (Contacts config)", () => {
  const contactOpts = {
    defaultRegistry: DEFAULT_COLUMN_REGISTRY,
    columnFieldMapping: COLUMN_FIELD_MAPPING,
    lockedEnabledTabs: CONTACT_LOCKED_ENABLED_TABS,
  } as const;

  it("disables mapped columns when the governing tab is off", () => {
    const next = syncModuleColumnRegistryWithFields({
      ...contactOpts,
      columnRegistry: DEFAULT_COLUMN_REGISTRY,
      fields: {
        phones: [{ key: "number", label: "Phone", type: "text", enabled: true, order: 0 }],
      },
      enabledTabIds: ["emails", "custom"],
    });
    expect(next.find((col) => col.key === "phone")?.enabled).toBe(false);
  });

  it("disables mapped columns when the governing field is off", () => {
    const next = syncModuleColumnRegistryWithFields({
      ...contactOpts,
      columnRegistry: DEFAULT_COLUMN_REGISTRY,
      fields: {
        basic: [
          { key: "gender", label: "Gender", type: "select", enabled: false, order: 0 },
          { key: "firstName", label: "First", type: "text", enabled: true, order: 1 },
        ],
      },
      enabledTabIds: ["phones", "custom"],
    });
    expect(next.find((col) => col.key === "gender")?.enabled).toBe(false);
    expect(next.find((col) => col.key === "name")?.enabled).toBe(true);
  });

  it("preserves user preference for column visibility when field is active", () => {
    const disabledPhone = DEFAULT_COLUMN_REGISTRY.map((col) =>
      col.key === "phone" ? { ...col, enabled: false } : col,
    );
    const next = syncModuleColumnRegistryWithFields({
      ...contactOpts,
      columnRegistry: disabledPhone,
      fields: {
        phones: [{ key: "number", label: "Phone", type: "text", enabled: true, order: 0 }],
      },
      enabledTabIds: ["phones", "custom"],
    });
    expect(next.find((col) => col.key === "phone")?.enabled).toBe(false);
  });

  it("soft-merges unknown system keys by default", () => {
    const next = syncModuleColumnRegistryWithFields({
      ...contactOpts,
      columnRegistry: [
        ...DEFAULT_COLUMN_REGISTRY,
        { key: "legacyExtra", label: "Legacy", enabled: true, order: 99 },
      ],
      fields: {},
      enabledTabIds: ["phones"],
    });
    expect(next.find((col) => col.key === "legacyExtra")?.enabled).toBe(true);
  });
});

describe("syncModuleColumnRegistryWithFields (Students config)", () => {
  const studentOpts = {
    defaultRegistry: DEFAULT_STUDENT_COLUMN_REGISTRY,
    columnFieldMapping: STUDENT_COLUMN_FIELD_MAPPING,
    lockedEnabledTabs: ["basic"] as const,
    listEnabledCustomFields: listEnabledCustomStudentFormFields,
    dropUnknownSystemKeys: true,
  };

  it("disables mapped columns when the governing tab is off", () => {
    const next = syncModuleColumnRegistryWithFields({
      ...studentOpts,
      columnRegistry: DEFAULT_STUDENT_COLUMN_REGISTRY,
      fields: studentBaseFields,
      enabledTabIds: [],
    });
    expect(next.find((col) => col.key === "status")?.enabled).toBe(false);
    expect(next.find((col) => col.key === "grNumber")?.enabled).toBe(false);
    expect(next.find((col) => col.key === "dob")?.enabled).toBe(true);
  });

  it("adds custom columns for enabled non-seed fields and drops them when disabled", () => {
    const withCustom: Record<string, FieldDefinition[]> = {
      ...studentBaseFields,
      basic: [
        ...studentBaseFields.basic,
        { key: "scholarship", label: "Scholarship", type: "text", enabled: true, order: 10 },
      ],
    };
    const next = syncModuleColumnRegistryWithFields({
      ...studentOpts,
      columnRegistry: DEFAULT_STUDENT_COLUMN_REGISTRY,
      fields: withCustom,
      enabledTabIds: ["registration"],
    });
    expect(next.find((col) => col.key === "custom:scholarship")?.enabled).toBe(true);

    const withoutCustom = syncModuleColumnRegistryWithFields({
      ...studentOpts,
      columnRegistry: next,
      fields: studentBaseFields,
      enabledTabIds: ["registration"],
    });
    expect(withoutCustom.find((col) => col.key === "custom:scholarship")).toBeUndefined();
  });

  it("drops legacy column keys not in the Work registry", () => {
    const next = syncModuleColumnRegistryWithFields({
      ...studentOpts,
      columnRegistry: [
        ...DEFAULT_STUDENT_COLUMN_REGISTRY,
        { key: "legacyFatherName", label: "Legacy", enabled: true, order: 99 },
      ],
      fields: studentBaseFields,
      enabledTabIds: ["registration"],
    });
    expect(next.find((col) => col.key === "legacyFatherName")).toBeUndefined();
  });
});
