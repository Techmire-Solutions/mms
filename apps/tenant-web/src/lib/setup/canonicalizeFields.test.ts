import { describe, expect, it } from "vitest";
import { canonicalizeField, canonicalizeFieldsMap } from "./canonicalizeFields";

describe("canonicalizeFields", () => {
  it("normalizes absolute field order to relative index within each form tab", () => {
    const map = canonicalizeFieldsMap(
      {
        basic: [
          {
            key: "b",
            label: "B",
            type: "text",
            enabled: true,
            required: false,
            unique: false,
            order: 50,
          },
          {
            key: "a",
            label: "A",
            type: "text",
            enabled: true,
            required: false,
            unique: false,
            order: 10,
          },
        ],
      },
      [{ key: "basic", label: "Basic", enabled: true, order: 0 }],
    );
    expect(map.basic?.map((field) => field.key)).toEqual(["a", "b"]);
    expect(map.basic?.map((field) => field.order)).toEqual([0, 1]);
  });

  it("scopes fields to formTabs and ignores orphan tabs", () => {
    const map = canonicalizeFieldsMap(
      {
        basic: [
          {
            key: "name",
            label: "Name",
            type: "text",
            enabled: true,
            required: false,
            unique: false,
            order: 0,
          },
        ],
        orphan: [
          {
            key: "x",
            label: "X",
            type: "text",
            enabled: true,
            required: false,
            unique: false,
            order: 0,
          },
        ],
      },
      [{ key: "basic", label: "Basic", enabled: true, order: 0 }],
    );
    expect(Object.keys(map)).toEqual(["basic"]);
    expect(map.orphan).toBeUndefined();
  });

  it("includes labelKey / options / placeholder in the canonical field shape", () => {
    const canonical = canonicalizeField({
      key: "status",
      label: "Status",
      type: "select",
      enabled: true,
      required: false,
      unique: false,
      order: 0,
      labelKey: "students.columns.status",
      options: ["active", "inactive"],
      placeholder: "Pick",
    });
    expect(canonical.labelKey).toBe("students.columns.status");
    expect(canonical.options).toEqual(["active", "inactive"]);
    expect(canonical.placeholder).toBe("Pick");
  });
});
