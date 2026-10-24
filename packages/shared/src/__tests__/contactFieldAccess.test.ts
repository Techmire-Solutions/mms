import { describe, expect, it } from "vitest";
import { canViewContactField, canViewContactTab } from "../contacts/contactFieldAccess.js";
import type { FieldDefinition, TabDefinition } from "../contacts/contactFieldSchemaTypes.js";

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    key: "firstName",
    label: "First Name",
    type: "text",
    enabled: true,
    order: 0,
    ...overrides,
  };
}

function makeTab(overrides: Partial<TabDefinition> = {}): TabDefinition {
  return {
    key: "basic",
    label: "Basic",
    enabled: true,
    order: 0,
    ...overrides,
  };
}

describe("contactFieldAccess", () => {
  describe("canViewContactField", () => {
    it("returns true when no permissions are set", () => {
      expect(canViewContactField("teacher", makeField())).toBe(true);
      expect(canViewContactField("teacher", makeField({ permissions: [] }))).toBe(true);
    });

    it("returns true when the role is in permissions", () => {
      expect(canViewContactField("admin", makeField({ permissions: ["admin", "teacher"] }))).toBe(
        true,
      );
    });

    it("returns false when the role is not in permissions", () => {
      expect(canViewContactField("viewer", makeField({ permissions: ["admin"] }))).toBe(false);
    });
  });

  describe("canViewContactTab", () => {
    it("returns false when the tab is disabled even if permissions allow", () => {
      expect(canViewContactTab("admin", makeTab({ enabled: false, permissions: ["admin"] }))).toBe(
        false,
      );
    });

    it("returns true for an enabled tab with no permissions", () => {
      expect(canViewContactTab("teacher", makeTab())).toBe(true);
      expect(canViewContactTab("teacher", makeTab({ permissions: [] }))).toBe(true);
    });

    it("returns role-gated result when permissions are present", () => {
      const tab = makeTab({ permissions: ["admin"] });
      expect(canViewContactTab("admin", tab)).toBe(true);
      expect(canViewContactTab("teacher", tab)).toBe(false);
    });
  });
});
