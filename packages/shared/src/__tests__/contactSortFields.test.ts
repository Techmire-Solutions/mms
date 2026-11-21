import { describe, expect, it } from "vitest";
import {
  CONTACT_SORT_FIELDS,
  DEFAULT_COLUMN_REGISTRY,
  resolveContactColumnSortField,
} from "../index.js";

describe("Contacts sort field SSOT", () => {
  it("every column marked sortable resolves to a server-supported sort key", () => {
    const unsupported = DEFAULT_COLUMN_REGISTRY.filter((entry) => entry.sortable)
      .filter((entry) => !resolveContactColumnSortField(entry.key))
      .map((entry) => entry.key);
    expect(unsupported).toEqual([]);
  });

  it("maps columns to their declared sortField (lunar DOB sorts by dob)", () => {
    expect(resolveContactColumnSortField("lunarDob")).toBe("dob");
    expect(resolveContactColumnSortField("name")).toBe("name");
    expect(resolveContactColumnSortField("city")).toBe("city");
  });

  it("returns undefined for non-sortable, custom, and unknown columns", () => {
    expect(resolveContactColumnSortField("phone")).toBeUndefined();
    expect(resolveContactColumnSortField("email")).toBeUndefined();
    expect(resolveContactColumnSortField("custom_favouriteColour")).toBeUndefined();
    expect(resolveContactColumnSortField("")).toBeUndefined();
  });

  it("only exposes keys the server sort allowlist knows", () => {
    for (const entry of DEFAULT_COLUMN_REGISTRY) {
      const field = resolveContactColumnSortField(entry.key);
      if (field) expect(CONTACT_SORT_FIELDS.has(field)).toBe(true);
    }
  });
});
