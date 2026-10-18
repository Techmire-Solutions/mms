import { describe, expect, it } from "vitest";
import { matchesWidgetFilter } from "./widgetFilterUtils.js";

describe("matchesWidgetFilter", () => {
  it("returns true when item or filterField is missing", () => {
    expect(matchesWidgetFilter(null)).toBe(true);
    expect(matchesWidgetFilter({ status: "active" })).toBe(true);
  });

  it("returns false when targeted field is missing on item", () => {
    expect(matchesWidgetFilter({}, "status", "equals", "active")).toBe(false);
  });

  it("evaluates equals filter correctly", () => {
    expect(matchesWidgetFilter({ status: "Active" }, "status", "equals", "active")).toBe(true);
    expect(matchesWidgetFilter({ status: "inactive" }, "status", "equals", "active")).toBe(false);
  });

  it("evaluates contains filter correctly", () => {
    expect(matchesWidgetFilter({ name: "High School" }, "name", "contains", "school")).toBe(true);
    expect(matchesWidgetFilter({ name: "Primary" }, "name", "contains", "school")).toBe(false);
  });

  it("evaluates numeric comparison filters gt and lt", () => {
    expect(matchesWidgetFilter({ age: 15 }, "age", "gt", "10")).toBe(true);
    expect(matchesWidgetFilter({ age: 5 }, "age", "gt", "10")).toBe(false);
    expect(matchesWidgetFilter({ age: 5 }, "age", "lt", "10")).toBe(true);
  });
});
