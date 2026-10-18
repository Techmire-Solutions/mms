import { describe, expect, it } from "vitest";
import {
  DEFAULT_FACULTY_COLUMN_REGISTRY,
  DEFAULT_FACULTY_SETTINGS,
  buildFacultyWorkColumnRegistry,
  syncFacultyColumnRegistryWithFields,
  FACULTY_WORK_COLUMN_PLACEHOLDER_LABELS,
} from "../index.js";

describe("syncFacultyColumnRegistryWithFields", () => {
  it("keeps mapped Work columns when seed fields are enabled", () => {
    const synced = syncFacultyColumnRegistryWithFields(
      DEFAULT_FACULTY_COLUMN_REGISTRY,
      {
        designation: [
          { key: "designationId", label: "Designation", type: "select", enabled: true, order: 0 },
        ],
        employment: [
          { key: "employmentStartDate", label: "Start", type: "date", enabled: true, order: 0 },
          { key: "status", label: "Status", type: "select", enabled: true, order: 1 },
        ],
      },
      ["designation", "employment"],
    );
    expect(synced.some((col) => col.key === "designation" && col.enabled !== false)).toBe(true);
    expect(synced.some((col) => col.key === "status" && col.enabled !== false)).toBe(true);
  });

  it("disables mapped Work columns when the draft field is disabled", () => {
    const synced = syncFacultyColumnRegistryWithFields(
      DEFAULT_FACULTY_COLUMN_REGISTRY,
      {
        designation: [
          { key: "designationId", label: "Designation", type: "select", enabled: true, order: 0 },
        ],
        employment: [
          { key: "employmentStartDate", label: "Start", type: "date", enabled: true, order: 0 },
          { key: "status", label: "Status", type: "select", enabled: false, order: 1 },
        ],
      },
      ["designation", "employment"],
    );
    expect(synced.find((col) => col.key === "status")?.enabled).toBe(false);
    expect(synced.find((col) => col.key === "designation")?.enabled).not.toBe(false);
  });

  it("adds custom Work columns for enabled non-seed fields", () => {
    const synced = syncFacultyColumnRegistryWithFields(
      undefined,
      {
        employment: [{ key: "extraNote", label: "Extra", type: "text", enabled: true, order: 0 }],
      },
      ["employment"],
    );
    expect(synced.some((col) => col.key === "custom:extraNote" && col.enabled !== false)).toBe(
      true,
    );
  });

  it("drops custom Work columns when the draft field is disabled", () => {
    const synced = syncFacultyColumnRegistryWithFields(
      [{ key: "custom:extraNote", label: "Extra", enabled: true, order: 5 }],
      {
        employment: [{ key: "extraNote", label: "Extra", type: "text", enabled: false, order: 0 }],
      },
      ["employment"],
    );
    expect(synced.some((col) => col.key === "custom:extraNote")).toBe(false);
  });
});

describe("buildFacultyWorkColumnRegistry", () => {
  it("keeps custom columns from stored columnRegistry when Fields still enable them", () => {
    const registry = buildFacultyWorkColumnRegistry(
      {
        ...DEFAULT_FACULTY_SETTINGS,
        fields: {
          employment: [{ key: "extraNote", label: "Extra", type: "text", enabled: true, order: 0 }],
        },
        columnRegistry: [
          ...DEFAULT_FACULTY_COLUMN_REGISTRY,
          { key: "custom:extraNote", label: "Extra", enabled: true, order: 20, width: 160 },
        ],
        enabledTabs: ["basic", "employment"],
      },
      FACULTY_WORK_COLUMN_PLACEHOLDER_LABELS,
    );
    const custom = registry.find((col) => col.key === "custom:extraNote");
    expect(custom?.enabled).not.toBe(false);
    expect(custom?.width).toBe(160);
  });

  it("disables system columns when tabbed Fields disable the mapped field", () => {
    const registry = buildFacultyWorkColumnRegistry(
      {
        ...DEFAULT_FACULTY_SETTINGS,
        fields: {
          designation: [
            { key: "designationId", label: "Designation", type: "select", enabled: true, order: 0 },
          ],
          employment: [
            { key: "employmentStartDate", label: "Start", type: "date", enabled: true, order: 0 },
            { key: "status", label: "Status", type: "select", enabled: false, order: 1 },
          ],
        },
        enabledTabs: ["basic", "employment", "designation"],
      },
      FACULTY_WORK_COLUMN_PLACEHOLDER_LABELS,
    );
    expect(registry.find((col) => col.key === "status")?.enabled).toBe(false);
  });

  it("includes custom columns from the tabbed Fields map", () => {
    const registry = buildFacultyWorkColumnRegistry(
      {
        ...DEFAULT_FACULTY_SETTINGS,
        fields: {
          employment: [{ key: "extraNote", label: "Extra", type: "text", enabled: true, order: 0 }],
        },
        enabledTabs: ["basic", "employment"],
      },
      FACULTY_WORK_COLUMN_PLACEHOLDER_LABELS,
    );
    expect(registry.some((col) => col.key === "custom:extraNote")).toBe(true);
  });
});
