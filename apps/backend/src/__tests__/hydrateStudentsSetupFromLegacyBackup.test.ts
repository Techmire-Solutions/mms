import { describe, expect, it } from "vitest";
import { hydrateStudentsSetupCollectionsFromLegacyObjects } from "../db/hydrateStudentsSetupFromLegacyBackup.js";

describe("hydrateStudentsSetupCollectionsFromLegacyObjects", () => {
  it("no-ops without users (partial payload)", () => {
    const collections = { students: [{ id: "s-1" }] };
    const next = hydrateStudentsSetupCollectionsFromLegacyObjects(collections, {
      students_settings: { fields: {}, autoGenerateId: true },
    });
    expect(next).toEqual(collections);
  });

  it("hydrates field-config and preferences from students_settings when typed collections empty", () => {
    const next = hydrateStudentsSetupCollectionsFromLegacyObjects(
      { users: [{ id: "u-1" }] },
      {
        students_settings: {
          fields: {
            basic: [{ key: "grNumber", label: "GR", type: "text", enabled: true, order: 0 }],
          },
          autoGenerateId: false,
          grNumberTemplate: "GR-{seq}",
          grNumberDigits: 3,
          grNumberRestartAnnually: false,
        },
      },
    );
    expect(next.student_field_configs).toHaveLength(1);
    expect(next.student_module_preferences).toHaveLength(1);
    const prefsRow = next.student_module_preferences?.[0] as {
      preferences: Record<string, unknown>;
    };
    expect(prefsRow.preferences.grNumberTemplate).toBe("GR-{seq}");
    expect(prefsRow.preferences.autoGenerateId).toBe(false);
  });

  it("does not overwrite non-empty typed Setup collections", () => {
    const existing = [{ config: { version: 1 } }];
    const next = hydrateStudentsSetupCollectionsFromLegacyObjects(
      {
        users: [{ id: "u-1" }],
        student_field_configs: existing,
        student_module_preferences: [{ preferences: { autoGenerateId: true } }],
      },
      {
        students_settings: { autoGenerateId: false, grNumberTemplate: "X-{seq}" },
      },
    );
    expect(next.student_field_configs).toBe(existing);
  });

  it("expands student_user_column_preferences map into typed rows", () => {
    const next = hydrateStudentsSetupCollectionsFromLegacyObjects(
      { users: [{ id: "u-1" }] },
      {
        student_user_column_preferences: {
          "u-admin": [{ key: "name", enabled: true, order: 0 }],
          "u-teacher": [{ key: "grNumber", enabled: false, order: 1 }],
        },
      },
    );
    expect(next.student_user_column_prefs).toEqual([
      { userId: "u-admin", preferences: [{ key: "name", enabled: true, order: 0 }] },
      { userId: "u-teacher", preferences: [{ key: "grNumber", enabled: false, order: 1 }] },
    ]);
  });
});
