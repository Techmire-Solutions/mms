import { describe, expect, it } from "vitest";
import {
  COUNTRY_CODES,
  curatedContactCountryCodes,
  needsContactCountryCodesCurate,
} from "./contactPreferenceDefaults.js";

describe("needsContactCountryCodesCurate", () => {
  it("is false for the curated seed", () => {
    expect(needsContactCountryCodesCurate(COUNTRY_CODES)).toBe(false);
  });

  it("is true when a retired seed country is present", () => {
    expect(
      needsContactCountryCodesCurate([
        { country: "Pakistan", code: "+92" },
        { country: "Canada", code: "+1" },
      ]),
    ).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(needsContactCountryCodesCurate([{ country: "  bangladesh ", code: "+880" }])).toBe(true);
  });
});

describe("curatedContactCountryCodes", () => {
  it("returns a fresh copy of the curated list", () => {
    const copy = curatedContactCountryCodes();
    expect(copy).toEqual(COUNTRY_CODES);
    expect(copy).not.toBe(COUNTRY_CODES);
    copy[0].country = "Mutated";
    expect(COUNTRY_CODES[0].country).toBe("Pakistan");
  });
});
