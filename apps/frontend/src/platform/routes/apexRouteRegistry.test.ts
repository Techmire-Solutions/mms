import { describe, expect, it } from "vitest";
import { ROUTES } from "@/lib/config/routes";
import { PLATFORM_CONSOLE_ENTRIES, PLATFORM_CONSOLE_GROUPS } from "./apexRouteRegistry";

const ROUTE_VALUES = new Set<string>(Object.values(ROUTES));

describe("apexRouteRegistry", () => {
  it("has unique ids and paths", () => {
    const ids = PLATFORM_CONSOLE_ENTRIES.map((entry) => entry.id);
    const paths = PLATFORM_CONSOLE_ENTRIES.map((entry) => entry.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("declares either a loader or a redirectTo for every entry", () => {
    for (const entry of PLATFORM_CONSOLE_ENTRIES) {
      const hasLoader = typeof entry.loader === "function";
      const hasRedirect = typeof entry.redirectTo === "string";
      expect(hasLoader !== hasRedirect, entry.id).toBe(true);
    }
  });

  it("uses ROUTES values for every path and redirect target", () => {
    for (const entry of PLATFORM_CONSOLE_ENTRIES) {
      expect(ROUTE_VALUES.has(entry.path), entry.path).toBe(true);
      if (entry.redirectTo) {
        expect(ROUTE_VALUES.has(entry.redirectTo), entry.redirectTo).toBe(true);
      }
    }
  });

  it("groups cover every entry exactly once, matching the group permission", () => {
    const grouped = PLATFORM_CONSOLE_GROUPS.flatMap((group) =>
      group.entries.map((entry) => entry.id),
    );
    expect(grouped.sort()).toEqual(PLATFORM_CONSOLE_ENTRIES.map((entry) => entry.id).sort());
    for (const group of PLATFORM_CONSOLE_GROUPS) {
      expect(group.entries.length).toBeGreaterThan(0);
      for (const entry of group.entries) {
        expect(entry.permission).toBe(group.permission);
      }
    }
  });

  it("pins the permission groups (IA ratchet)", () => {
    expect(new Set(PLATFORM_CONSOLE_ENTRIES.map((entry) => entry.permission))).toEqual(
      new Set([null, "workspaces", "onboard", "admins", "settings", "system"]),
    );
  });
});
