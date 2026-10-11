import { describe, expect, it } from "vitest";
import { roleHasPermission } from "@mms/shared";
import { SETTINGS_NAV } from "./settingsNavConfig";

function visibleSectionsFor(role: string): string[] {
  return SETTINGS_NAV.filter(
    (item) => !item.requiredPermission || roleHasPermission(role, item.requiredPermission),
  ).map((item) => item.id);
}

describe("SETTINGS_NAV role visibility", () => {
  it("shows only General and Theme to a non-admin role", () => {
    expect(visibleSectionsFor("teacher")).toEqual(["global", "theme"]);
  });

  it("shows all sections to admin", () => {
    expect(visibleSectionsFor("admin")).toEqual([
      "global",
      "branding",
      "theme",
      "llm",
      "modules",
      "backup",
    ]);
  });

  it("shows all sections to super_admin", () => {
    expect(visibleSectionsFor("super_admin")).toEqual([
      "global",
      "branding",
      "theme",
      "llm",
      "modules",
      "backup",
    ]);
  });
});
