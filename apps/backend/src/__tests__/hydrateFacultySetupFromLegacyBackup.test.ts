import { describe, expect, it } from "vitest";
import {
  hydrateFacultySetupCollectionsFromLegacyObjects,
  FACULTY_SETTINGS_OBJECT_KEY,
  FACULTY_COLUMN_PREFS_OBJECT_KEY,
  FACULTY_LEGACY_SETUP_OBJECT_KEYS,
} from "../db/hydrateFacultySetupFromLegacyBackup.js";

describe("Faculty Setup hydrate constants", () => {
  it("exports canonical object keys and skip-list for typed hydrate", () => {
    expect(FACULTY_SETTINGS_OBJECT_KEY).toBe("faculty_settings");
    expect(FACULTY_COLUMN_PREFS_OBJECT_KEY).toBe("faculty_user_column_preferences");
    expect(FACULTY_LEGACY_SETUP_OBJECT_KEYS).toEqual([
      "faculty_settings",
      "faculty_user_column_preferences",
      "faculty_field_config",
    ]);
  });
});

describe("hydrateFacultySetupCollectionsFromLegacyObjects", () => {
  it("no-ops without users (partial payload)", () => {
    const collections = { faculty: [{ id: "f-1" }] };
    const next = hydrateFacultySetupCollectionsFromLegacyObjects(collections, {
      [FACULTY_SETTINGS_OBJECT_KEY]: { fields: {}, autoGenerateId: true },
    });
    expect(next).toEqual(collections);
  });

  it("no-ops when objects store is undefined", () => {
    const collections = { users: [{ id: "u-1" }], faculty: [{ id: "f-1" }] };
    const next = hydrateFacultySetupCollectionsFromLegacyObjects(collections, undefined);
    expect(next).toEqual(collections);
  });

  it("hydrates field-config and preferences from modern faculty_settings", () => {
    const next = hydrateFacultySetupCollectionsFromLegacyObjects(
      { users: [{ id: "u-1" }] },
      {
        [FACULTY_SETTINGS_OBJECT_KEY]: {
          fields: {
            basic: [
              { key: "specialization", label: "Spec", type: "select", enabled: true, order: 0 },
            ],
          },
          autoGenerateId: true,
          employeeIdPrefix: "FAC",
          requireContactLink: true,
          defaultSpecialization: "Islamic Studies",
        },
      },
    );
    expect(next.faculty_field_configs).toHaveLength(1);
    expect(next.faculty_module_preferences).toHaveLength(1);
    const fieldRow = next.faculty_field_configs?.[0] as {
      config: { fields?: Record<string, unknown> };
    };
    expect(fieldRow.config.fields).toBeDefined();
    const prefsRow = next.faculty_module_preferences?.[0] as {
      preferences: Record<string, unknown>;
    };
    expect(prefsRow.preferences.employeeIdPrefix).toBe("FAC");
    expect(prefsRow.preferences.autoGenerateId).toBe(true);
  });

  it("does not overwrite non-empty typed Setup collections", () => {
    const existing = [{ config: { version: 1 } }];
    const next = hydrateFacultySetupCollectionsFromLegacyObjects(
      {
        users: [{ id: "u-1" }],
        faculty_field_configs: existing,
        faculty_module_preferences: [{ preferences: { autoGenerateId: true } }],
      },
      {
        [FACULTY_SETTINGS_OBJECT_KEY]: { autoGenerateId: false, employeeIdPrefix: "X" },
      },
    );
    expect(next.faculty_field_configs).toBe(existing);
  });

  it("expands modern faculty_user_column_preferences map into typed rows", () => {
    const next = hydrateFacultySetupCollectionsFromLegacyObjects(
      { users: [{ id: "u-1" }] },
      {
        [FACULTY_COLUMN_PREFS_OBJECT_KEY]: {
          "u-admin": [{ key: "name", enabled: true, order: 0 }],
          "u-faculty": [{ key: "specialization", enabled: false, order: 1 }],
        },
      },
    );
    expect(next.faculty_user_column_prefs).toEqual([
      { userId: "u-admin", preferences: [{ key: "name", enabled: true, order: 0 }] },
      { userId: "u-faculty", preferences: [{ key: "specialization", enabled: false, order: 1 }] },
    ]);
  });

  it("ignores historical teachers_settings blobs (no longer hydrated)", () => {
    const next = hydrateFacultySetupCollectionsFromLegacyObjects(
      { users: [{ id: "u-1" }] },
      {
        teachers_settings: {
          fields: {
            basic: [
              { key: "specialization", label: "Spec", type: "select", enabled: true, order: 0 },
            ],
          },
          autoGenerateId: false,
          idPrefix: "TCH",
        },
      },
    );
    expect(next.faculty_field_configs).toBeUndefined();
    expect(next.faculty_module_preferences).toBeUndefined();
  });
});
