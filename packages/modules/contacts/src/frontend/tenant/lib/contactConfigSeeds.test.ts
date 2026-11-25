import { describe, expect, it } from "vitest";
import {
  COUNTRY_CODES,
  DEFAULT_ADDRESS_LABELS,
  DEFAULT_EMAIL_LABELS,
  DEFAULT_PHONE_LABELS,
  GENDERS,
  RELATIONSHIPS,
  SOCIAL_PLATFORMS,
} from "@mms/contracts";
import { getContactConfigCollectionDefaults } from "./contactConfigSeeds.js";

describe("getContactConfigCollectionDefaults", () => {
  it("returns copies of the shared DEFAULT_* constants", () => {
    const seeds = getContactConfigCollectionDefaults();
    expect(seeds.genders).toEqual(GENDERS);
    expect(seeds.socialPlatforms).toEqual(SOCIAL_PLATFORMS);
    expect(seeds.relationships).toEqual(RELATIONSHIPS);
    expect(seeds.phoneLabels).toEqual(DEFAULT_PHONE_LABELS);
    expect(seeds.emailLabels).toEqual(DEFAULT_EMAIL_LABELS);
    expect(seeds.addressLabels).toEqual(DEFAULT_ADDRESS_LABELS);
  });

  it("returns country codes mapped from COUNTRY_CODES as fresh object copies", () => {
    const seeds = getContactConfigCollectionDefaults();
    expect(seeds.countryCodes).toEqual(COUNTRY_CODES);
    expect(seeds.countryCodes).not.toBe(COUNTRY_CODES);
    expect(seeds.countryCodes[0]).not.toBe(COUNTRY_CODES[0]);
  });

  it("returns fresh array copies that can be mutated without affecting the sources", () => {
    const seeds = getContactConfigCollectionDefaults();
    seeds.genders.push("other");
    seeds.socialPlatforms.length = 0;
    seeds.countryCodes.pop();

    expect(GENDERS).not.toContain("other");
    expect(SOCIAL_PLATFORMS.length).toBeGreaterThan(0);
    expect(COUNTRY_CODES.length).toBeGreaterThan(seeds.countryCodes.length);
  });
});
