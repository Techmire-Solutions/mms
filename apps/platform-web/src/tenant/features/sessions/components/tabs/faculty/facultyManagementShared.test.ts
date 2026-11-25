import { describe, expect, it } from "vitest";
import type { AppTranslationKey } from "@mms/contracts";
import { COMMON_FACULTY_ROLES, facultyRoleLabel } from "./facultyManagementShared";

describe("faculty role i18n", () => {
  it("resolves every common role through a translation key (no raw English labels)", () => {
    const t = (key: AppTranslationKey) => key;
    for (const role of COMMON_FACULTY_ROLES) {
      expect(role.labelKey, role.value).toMatch(/^sessions\.faculty\.roles\./);
      expect(facultyRoleLabel(role.value, t), role.value).toBe(role.labelKey);
    }
  });

  it("returns custom/unknown roles verbatim", () => {
    const t = (key: AppTranslationKey) => key;
    expect(facultyRoleLabel("Vice Principal", t)).toBe("Vice Principal");
  });
});
