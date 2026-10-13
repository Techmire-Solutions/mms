import { describe, expect, it } from "vitest";
import {
  contactIdentityMatchBodySchema,
  contactIdentityMatchResultSchema,
} from "../contacts/contactIdentityMatch.js";

describe("contactIdentityMatchBodySchema", () => {
  it("parses a body with phones, emails, and names arrays", () => {
    const parsed = contactIdentityMatchBodySchema.parse({
      phones: ["+923001234567"],
      emails: ["a@example.com"],
      names: ["Aisha Khan"],
    });
    expect(parsed.phones).toEqual(["+923001234567"]);
    expect(parsed.emails).toEqual(["a@example.com"]);
    expect(parsed.names).toEqual(["Aisha Khan"]);
  });

  it("defaults missing keys to empty arrays", () => {
    const parsed = contactIdentityMatchBodySchema.parse({});
    expect(parsed.phones).toEqual([]);
    expect(parsed.emails).toEqual([]);
    expect(parsed.names).toEqual([]);
  });

  it("trims and drops empty strings from arrays", () => {
    const parsed = contactIdentityMatchBodySchema.parse({
      phones: ["  +923001234567  ", "", "   "],
    });
    expect(parsed.phones).toEqual(["+923001234567"]);
  });

  it("de-duplicates repeated values", () => {
    const parsed = contactIdentityMatchBodySchema.parse({
      emails: ["a@example.com", "a@example.com"],
    });
    expect(parsed.emails).toEqual(["a@example.com"]);
  });

  it("rejects items longer than 320 characters", () => {
    expect(() => contactIdentityMatchBodySchema.parse({ names: ["x".repeat(321)] })).toThrow();
  });

  it("rejects arrays over 2000 entries", () => {
    expect(() =>
      contactIdentityMatchBodySchema.parse({
        phones: Array.from({ length: 2001 }, (_, i) => `${i}`),
      }),
    ).toThrow();
  });
});

describe("contactIdentityMatchResultSchema", () => {
  it("parses the result shape", () => {
    const parsed = contactIdentityMatchResultSchema.parse({
      phones: ["+923001234567"],
      emails: [],
      names: ["Aisha"],
    });
    expect(parsed.phones).toEqual(["+923001234567"]);
    expect(parsed.emails).toEqual([]);
  });
});
