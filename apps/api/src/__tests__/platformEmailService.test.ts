import { afterEach, describe, expect, it } from "vitest";
import { isPlatformSmtpConfigured } from "../services/platform/platformEmailService.js";

describe("platformEmailService", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("is configured when Resend API key and from address are set", () => {
    process.env = {
      ...env,
      PLATFORM_RESEND_API_KEY: "re_test_key",
      PLATFORM_EMAIL_FROM: "noreply@example.com",
    };
    expect(isPlatformSmtpConfigured()).toBe(true);
  });

  it("is configured when full SMTP vars are set", () => {
    process.env = {
      ...env,
      PLATFORM_SMTP_HOST: "smtp.example.com",
      PLATFORM_SMTP_USER: "user",
      PLATFORM_SMTP_PASS: "pass",
      PLATFORM_EMAIL_FROM: "noreply@example.com",
    };
    expect(isPlatformSmtpConfigured()).toBe(true);
  });

  it("is not configured when no provider vars are set", () => {
    process.env = {
      ...env,
      PLATFORM_RESEND_API_KEY: "",
      PLATFORM_SMTP_HOST: "",
      PLATFORM_SMTP_USER: "",
      PLATFORM_SMTP_PASS: "",
      PLATFORM_EMAIL_FROM: "",
    };
    expect(isPlatformSmtpConfigured()).toBe(false);
  });
});
