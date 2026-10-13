import { describe, expect, it } from "vitest";
import { getFlatFieldsConfig, mergeTabbedFields } from "./moduleFieldConfigUtils.js";

describe("moduleFieldConfigUtils", () => {
  it("returns defaults unchanged when no override is provided", () => {
    const defaults = { basic: [{ key: "name" }] };

    expect(mergeTabbedFields(defaults)).toBe(defaults);
  });

  it("replaces array tabs and shallow-merges map tabs", () => {
    const defaults = {
      basic: [{ key: "name" }],
      setup: {
        status: { enabled: true, required: false },
        notes: { enabled: true, required: false },
      },
    };

    expect(
      mergeTabbedFields(defaults, {
        basic: [{ key: "email" }],
        setup: {
          status: { enabled: false, required: true },
        },
      }),
    ).toEqual({
      basic: [{ key: "email" }],
      setup: {
        status: { enabled: false, required: true },
        notes: { enabled: true, required: false },
      },
    });
  });

  it("flattens array-based field definitions", () => {
    expect(
      getFlatFieldsConfig({
        basic: [{ key: "name", enabled: false, required: true }, { key: "email" }, null],
      }),
    ).toEqual({
      name: { enabled: false, required: true },
      email: { enabled: true, required: false },
    });
  });

  it("flattens map-based field configuration and preserves truthy required values", () => {
    expect(
      getFlatFieldsConfig({
        basic: {
          name: { enabled: false, required: "yes" },
          email: {},
        },
      }),
    ).toEqual({
      name: { enabled: false, required: true },
      email: { enabled: true, required: false },
    });
  });
});
