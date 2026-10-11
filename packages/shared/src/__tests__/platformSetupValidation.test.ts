import { describe, expect, it } from "vitest";
import {
  normalizePlatformEmail,
  isValidEmail,
  validatePlatformSetupEmail,
  validatePlatformSetupName,
  validatePlatformSetupPassword,
  validatePlatformPasswordMatch,
} from "../platformSetupValidation.js";

describe("platformSetupValidation", () => {
  it("normalizes platform email strings", () => {
    expect(normalizePlatformEmail("  ADMIN@Example.COM ")).toBe("admin@example.com");
  });

  it("validates email syntax", () => {
    expect(isValidEmail("admin@example.com")).toBe(true);
    expect(isValidEmail("invalid-email")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });

  it("validates platform setup email address", () => {
    expect(validatePlatformSetupEmail("user@domain.com")).toBeNull();
    expect(validatePlatformSetupEmail("bad-email")).toBe("platform.setupInvalidEmail");
  });

  it("validates platform setup full name", () => {
    expect(validatePlatformSetupName("Super Admin")).toBeNull();
    expect(validatePlatformSetupName("a")).toBe("platform.setupInvalidName");
    expect(validatePlatformSetupName("   ")).toBe("platform.setupInvalidName");
  });

  it("validates platform setup password rules", () => {
    expect(validatePlatformSetupPassword("SecretPass123")).toBeNull();
    expect(validatePlatformSetupPassword("short1")).toBe("platform.setupPasswordTooShort");
    expect(validatePlatformSetupPassword("allletterswithoutdigits")).toBe(
      "platform.setupPasswordWeak",
    );
  });

  it("validates password match", () => {
    expect(validatePlatformPasswordMatch("Secret123", "Secret123")).toBeNull();
    expect(validatePlatformPasswordMatch("Secret123", "Different123")).toBe(
      "platform.forgotPasswordMismatch",
    );
  });
});
