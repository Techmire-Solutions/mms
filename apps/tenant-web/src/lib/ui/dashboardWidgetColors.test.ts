import { describe, expect, it } from "vitest";
import {
  widgetColorToAccent,
  getWidgetColorTheme,
  getQuickActionIconClasses,
  getQuickActionGlowClass,
} from "./dashboardWidgetColors";

describe("dashboardWidgetColors", () => {
  it("maps color tokens to WidgetCard accents", () => {
    expect(widgetColorToAccent("emerald")).toBe("success");
    expect(widgetColorToAccent("blue")).toBe("info");
    expect(widgetColorToAccent("violet")).toBe("primary");
    expect(widgetColorToAccent("amber")).toBe("warning");
    expect(widgetColorToAccent("red")).toBe("destructive");
    expect(widgetColorToAccent(undefined)).toBe("primary");
  });

  it("retrieves widget color themes", () => {
    const theme = getWidgetColorTheme("emerald");
    expect(typeof theme).toBe("object");
    expect(typeof theme.bg).toBe("string");
    expect(theme.bg.length).toBeGreaterThan(0);
  });

  it("builds quick action icon classes for slate and custom colors", () => {
    expect(getQuickActionIconClasses("slate")).toBe("bg-muted text-muted-foreground");
    const emeraldClasses = getQuickActionIconClasses("emerald");
    expect(emeraldClasses).toBe("bg-success/10 text-success");
  });

  it("builds quick action glow classes", () => {
    expect(getQuickActionGlowClass("slate")).toBe("bg-muted-foreground/15");
    const glow = getQuickActionGlowClass("emerald");
    expect(typeof glow).toBe("string");
    expect(glow.length).toBeGreaterThan(0);
  });
});
