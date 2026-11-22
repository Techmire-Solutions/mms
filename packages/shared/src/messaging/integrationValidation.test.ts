import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMAIL_INTEGRATION,
  type EmailIntegrationConfig,
  type EmailProviderId,
} from "./emailIntegrationTypes.js";
import {
  DEFAULT_SMS_INTEGRATION,
  type SmsIntegrationConfig,
  type SmsProviderId,
} from "./smsIntegrationTypes.js";
import {
  validateEmailIntegrationConfig,
  validateSmsIntegrationConfig,
} from "./integrationValidation.js";

const smsConfig = (overrides: Partial<SmsIntegrationConfig> = {}): SmsIntegrationConfig => ({
  ...DEFAULT_SMS_INTEGRATION,
  ...overrides,
});

const emailConfig = (overrides: Partial<EmailIntegrationConfig> = {}): EmailIntegrationConfig => ({
  ...DEFAULT_EMAIL_INTEGRATION,
  ...overrides,
});

describe("validateSmsIntegrationConfig", () => {
  it("accepts a fully configured Twilio-like provider with a secret", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({ providerId: "twilio", accountId: "AC123", senderId: "+15005550006" }),
        { requiresBaseUrl: false, accountSecretProvided: true },
      ),
    ).toBeNull();
  });

  it("returns null for providers that do not need an account id", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({ providerId: "msg91", accountId: "", senderId: "SENDER" }),
        { requiresBaseUrl: false, accountSecretProvided: true },
      ),
    ).toBeNull();
  });

  it("returns null when logiqueues has no sender id", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({ providerId: "logiqueues", accountId: "", senderId: "" }),
        { requiresBaseUrl: false, accountSecretProvided: true },
      ),
    ).toBeNull();
  });

  it("rejects a missing provider id", () => {
    expect(
      validateSmsIntegrationConfig(smsConfig({ providerId: "" as SmsProviderId }), {
        requiresBaseUrl: false,
        accountSecretProvided: true,
      }),
    ).toBe("invalid_provider");
  });

  it("rejects a missing account id for providers that need one", () => {
    expect(
      validateSmsIntegrationConfig(smsConfig({ providerId: "twilio", accountId: "  " }), {
        requiresBaseUrl: false,
        accountSecretProvided: true,
      }),
    ).toBe("invalid_account_id");
  });

  it("rejects a missing sender id for providers that need one", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({ providerId: "twilio", accountId: "AC123", senderId: "" }),
        {
          requiresBaseUrl: false,
          accountSecretProvided: true,
        },
      ),
    ).toBe("invalid_sender_id");
  });

  it("rejects a missing secret when credentials are not already stored", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({ providerId: "twilio", accountId: "AC123", senderId: "S" }),
        { requiresBaseUrl: false, accountSecretProvided: false },
      ),
    ).toBe("invalid_secret");
  });

  it("accepts a missing secret when credentials are already stored", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({
          providerId: "twilio",
          accountId: "AC123",
          senderId: "S",
          hasCredentials: true,
        }),
        { requiresBaseUrl: false, accountSecretProvided: false },
      ),
    ).toBeNull();
  });

  it("rejects a missing base url when the preset requires one", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({ providerId: "infobip", accountId: "", senderId: "S", apiBaseUrl: "" }),
        { requiresBaseUrl: true, accountSecretProvided: true },
      ),
    ).toBe("invalid_base_url");
  });

  it("rejects a malformed base url when the preset requires one", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({ providerId: "infobip", senderId: "S", apiBaseUrl: "not a url" }),
        { requiresBaseUrl: true, accountSecretProvided: true },
      ),
    ).toBe("invalid_base_url");
  });

  it("accepts a valid base url", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({
          providerId: "infobip",
          senderId: "S",
          apiBaseUrl: " https://api.example.com ",
        }),
        { requiresBaseUrl: true, accountSecretProvided: true },
      ),
    ).toBeNull();
  });

  it("rejects a malformed test phone", () => {
    expect(
      validateSmsIntegrationConfig(
        smsConfig({ providerId: "twilio", accountId: "AC123", senderId: "S" }),
        { requiresBaseUrl: false, accountSecretProvided: true, testPhone: "abc" },
      ),
    ).toBe("invalid_test_phone");
  });

  it("accepts a valid test phone with or without a plus prefix", () => {
    for (const phone of ["+923001234567", "03001234567", " +923001234567 "]) {
      expect(
        validateSmsIntegrationConfig(
          smsConfig({ providerId: "twilio", accountId: "AC123", senderId: "S" }),
          { requiresBaseUrl: false, accountSecretProvided: true, testPhone: phone },
        ),
      ).toBeNull();
    }
  });
});

describe("validateEmailIntegrationConfig", () => {
  it("accepts a fully configured preset provider with a password", () => {
    expect(
      validateEmailIntegrationConfig(
        emailConfig({ providerId: "gmail", fromAddress: "a@b.com", smtpUsername: "a@b.com" }),
        { smtpPasswordProvided: true },
      ),
    ).toBeNull();
  });

  it("rejects a missing provider id", () => {
    expect(
      validateEmailIntegrationConfig(
        emailConfig({ providerId: "" as EmailProviderId, fromAddress: "a@b.com" }),
        { smtpPasswordProvided: true },
      ),
    ).toBe("invalid_provider");
  });

  it("rejects a malformed from address", () => {
    expect(
      validateEmailIntegrationConfig(
        emailConfig({ providerId: "gmail", fromAddress: "not-an-email" }),
        { smtpPasswordProvided: true },
      ),
    ).toBe("invalid_from_address");
  });

  it("rejects a missing smtp username", () => {
    expect(
      validateEmailIntegrationConfig(
        emailConfig({ providerId: "gmail", fromAddress: "a@b.com", smtpUsername: "  " }),
        { smtpPasswordProvided: true },
      ),
    ).toBe("invalid_username");
  });

  it("rejects a missing password when credentials are not already stored", () => {
    expect(
      validateEmailIntegrationConfig(
        emailConfig({ providerId: "gmail", fromAddress: "a@b.com", smtpUsername: "a@b.com" }),
        { smtpPasswordProvided: false },
      ),
    ).toBe("invalid_password");
  });

  it("accepts a missing password when credentials are already stored", () => {
    expect(
      validateEmailIntegrationConfig(
        emailConfig({
          providerId: "gmail",
          fromAddress: "a@b.com",
          smtpUsername: "a@b.com",
          hasCredentials: true,
        }),
        { smtpPasswordProvided: false },
      ),
    ).toBeNull();
  });

  it("rejects a missing host for custom smtp", () => {
    expect(
      validateEmailIntegrationConfig(
        emailConfig({
          providerId: "custom_smtp",
          fromAddress: "a@b.com",
          smtpUsername: "a@b.com",
          smtpHost: "",
        }),
        { smtpPasswordProvided: true },
      ),
    ).toBe("invalid_host");
  });

  it("rejects an invalid port for custom smtp", () => {
    for (const port of [0, 65536, -1, 25.5]) {
      expect(
        validateEmailIntegrationConfig(
          emailConfig({
            providerId: "custom_smtp",
            fromAddress: "a@b.com",
            smtpUsername: "a@b.com",
            smtpHost: "smtp.example.com",
            smtpPort: port,
          }),
          { smtpPasswordProvided: true },
        ),
      ).toBe("invalid_port");
    }
  });

  it("accepts a valid custom smtp port and ignores host checks for presets", () => {
    expect(
      validateEmailIntegrationConfig(
        emailConfig({
          providerId: "custom_smtp",
          fromAddress: "a@b.com",
          smtpUsername: "a@b.com",
          smtpHost: "smtp.example.com",
          smtpPort: 587,
        }),
        { smtpPasswordProvided: true },
      ),
    ).toBeNull();
    expect(
      validateEmailIntegrationConfig(
        emailConfig({ providerId: "gmail", fromAddress: "a@b.com", smtpUsername: "a@b.com" }),
        { smtpPasswordProvided: true },
      ),
    ).toBeNull();
  });
});
