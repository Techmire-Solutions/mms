import { describe, expect, it } from "vitest";
import { normalizePhoneInput } from "../phoneUtils.js";

describe("normalizePhoneInput", () => {
  it("normalizes local and international phone inputs to E.164", () => {
    expect(normalizePhoneInput("0300-1234567", "+92")).toBe("+923001234567");
    expect(normalizePhoneInput("0044 20 1234 5678")).toBe("+442012345678");
  });

  it("does not invent a country code for local input", () => {
    expect(normalizePhoneInput("0300-1234567")).toBe("03001234567");
  });

  it("preserves an empty optional phone", () => {
    expect(normalizePhoneInput("")).toBe("");
    expect(normalizePhoneInput(undefined)).toBe("");
  });
});
