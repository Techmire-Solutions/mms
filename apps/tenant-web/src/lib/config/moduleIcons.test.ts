import { describe, expect, it } from "vitest";
import { MODULE_ICONS, resolveModuleIcon } from "@/lib/config/moduleIcons";
import { Boxes, LayoutDashboard, Users } from "lucide-react";

describe("resolveModuleIcon", () => {
  it("returns the icon for a known module key", () => {
    expect(resolveModuleIcon("LayoutDashboard")).toBe(LayoutDashboard);
    expect(resolveModuleIcon("Users")).toBe(Users);
  });

  it("falls back to Boxes for unknown keys", () => {
    expect(resolveModuleIcon("Nope")).toBe(Boxes);
  });

  it("uses the provided fallback when given", () => {
    expect(resolveModuleIcon("Nope", LayoutDashboard)).toBe(LayoutDashboard);
  });

  it("exposes a non-empty icon registry", () => {
    expect(Object.keys(MODULE_ICONS).length).toBeGreaterThan(5);
  });
});
