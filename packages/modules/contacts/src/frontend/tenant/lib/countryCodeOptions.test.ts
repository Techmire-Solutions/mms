import { describe, expect, it } from "vitest";
import {
  mergeCountryDialCodeOptions,
  mergeCountryNameOptions,
  normalizeDialCode,
} from "./countryCodeOptions.js";

describe("countryCodeOptions", () => {
  it("normalizeDialCode adds leading + and strips spaces", () => {
    expect(normalizeDialCode("92")).toBe("+92");
    expect(normalizeDialCode("+92")).toBe("+92");
    expect(normalizeDialCode(" +1  ")).toBe("+1");
    expect(normalizeDialCode("")).toBe("");
  });

  it("mergeCountryDialCodeOptions keeps country names when dial removed", () => {
    const next = mergeCountryDialCodeOptions(
      [
        { country: "Pakistan", code: "+92" },
        { country: "USA", code: "+1" },
      ],
      ["+92", "+44"],
    );
    expect(next).toEqual([
      { country: "Pakistan", code: "+92" },
      { country: "USA", code: "" },
      { country: "+44", code: "+44" },
    ]);
  });

  it("mergeCountryNameOptions preserves dial codes for known countries", () => {
    const next = mergeCountryNameOptions(
      [
        { country: "Pakistan", code: "+92" },
        { country: "USA", code: "+1" },
      ],
      ["Pakistan", "UK"],
    );
    expect(next).toEqual([
      { country: "Pakistan", code: "+92" },
      { country: "UK", code: "" },
    ]);
  });
});
