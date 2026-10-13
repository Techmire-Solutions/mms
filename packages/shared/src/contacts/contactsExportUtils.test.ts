import { describe, expect, it } from "vitest";
import type { FieldConfig } from "./contactTypes.js";
import {
  filterContactExportColumnsForViewer,
  isExportableContactColumn,
  resolveContactFieldConfigSnapshot,
} from "./contactsExportUtils.js";
import { DEFAULT_FORM_TABS } from "./contactTabRegistry.js";

/** Minimal tenant config: basic + phones tabs, one role-restricted and one disabled field. */
function buildFieldConfig(overrides?: Partial<FieldConfig>): FieldConfig {
  return {
    version: 1,
    enabledTabs: ["basic", "phones"],
    requiredTabs: [],
    fields: {
      basic: [
        { key: "firstName", label: "First Name", type: "text", enabled: true, order: 0 },
        { key: "lastName", label: "Last Name", type: "text", enabled: true, order: 1 },
        { key: "gender", label: "Gender", type: "select", enabled: true, order: 2 },
        {
          key: "notes",
          label: "Notes",
          type: "textarea",
          enabled: true,
          order: 3,
          permissions: ["admin"],
        },
        { key: "retiredField", label: "Retired", type: "text", enabled: false, order: 4 },
      ],
      phones: [{ key: "number", label: "Phone Number", type: "text", enabled: true, order: 0 }],
    },
    formTabs: DEFAULT_FORM_TABS,
    ...overrides,
  };
}

const keptIds = (ids: string[], fieldConfig: FieldConfig | null, viewerRole: string): string[] =>
  filterContactExportColumnsForViewer(
    ids.map((id) => ({ id, label: id })),
    fieldConfig,
    viewerRole,
  ).map((column) => column.id);

describe("filterContactExportColumnsForViewer", () => {
  const config = buildFieldConfig();

  it("keeps registry columns whose governing field the viewer may read", () => {
    expect(keptIds(["name", "gender", "phone", "email"], config, "admin")).toEqual([
      "name",
      "gender",
      "phone",
      "email",
    ]);
  });

  it("drops unknown keys so the raw-property stringify fallback is unreachable", () => {
    expect(keptIds(["name", "deletedReason", "syncMeta", "anythingElse"], config, "admin")).toEqual(
      ["name"],
    );
  });

  it("drops configured fields the viewer role may not read", () => {
    expect(keptIds(["name", "notes"], config, "teacher")).toEqual(["name"]);
    expect(keptIds(["name", "notes"], config, "admin")).toEqual(["name", "notes"]);
  });

  it("drops known columns whose tab is disabled for the tenant", () => {
    // `formTabs[].enabled` is authoritative for tab enablement (see resolveContactEnabledTabIds).
    const phonesOff = buildFieldConfig({
      formTabs: DEFAULT_FORM_TABS.map((tab) =>
        tab.key === "phones" ? { ...tab, enabled: false } : tab,
      ),
    });
    expect(keptIds(["name", "phone"], phonesOff, "admin")).toEqual(["name"]);
  });

  it("drops disabled custom fields even for admins", () => {
    expect(keptIds(["name", "retiredField"], config, "admin")).toEqual(["name"]);
  });

  it("allows only registry columns when the tenant has no field config", () => {
    expect(keptIds(["name", "city", "deletedReason"], null, "admin")).toEqual(["name", "city"]);
  });
});

describe("isExportableContactColumn", () => {
  it("is fail-closed for unknown keys without a config context", () => {
    expect(isExportableContactColumn("admin", "name", null)).toBe(true);
    expect(isExportableContactColumn("admin", "deletedReason", null)).toBe(false);
  });
});

describe("resolveContactFieldConfigSnapshot", () => {
  it("uses the tenant config when present", () => {
    const config = buildFieldConfig();
    const snapshot = resolveContactFieldConfigSnapshot(config);
    expect(snapshot.fields).toBe(config.fields);
    expect(snapshot.tabs).toBe(DEFAULT_FORM_TABS);
  });

  it("falls back to the default seed instead of disabling sanitization", () => {
    const snapshot = resolveContactFieldConfigSnapshot(null);
    expect(Object.keys(snapshot.fields).length).toBeGreaterThan(0);
    expect(snapshot.tabs.length).toBeGreaterThan(0);
  });
});
