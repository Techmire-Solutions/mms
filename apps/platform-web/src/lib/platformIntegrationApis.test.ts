import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EMAIL_INTEGRATION, DEFAULT_SMS_INTEGRATION } from "@mms/contracts";
import {
  fetchPlatformEmailIntegration,
  savePlatformEmailIntegration,
  testPlatformEmailIntegration,
} from "./platformEmailIntegrationApi";
import {
  fetchPlatformSmsIntegration,
  savePlatformSmsIntegration,
  testPlatformSmsIntegration,
} from "./platformSmsIntegrationApi";

const apiJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@mms/fe-core/api/client", () => ({
  apiJson: apiJsonMock,
}));

describe("platformEmailIntegrationApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches email integration with or without an AbortSignal and returns null on failure", async () => {
    const controller = new AbortController();
    apiJsonMock.mockResolvedValueOnce(DEFAULT_EMAIL_INTEGRATION);
    await expect(fetchPlatformEmailIntegration(controller.signal)).resolves.toEqual(
      DEFAULT_EMAIL_INTEGRATION,
    );
    expect(apiJsonMock).toHaveBeenCalledWith("/api/platform/email/integration", {
      signal: controller.signal,
    });

    apiJsonMock.mockResolvedValueOnce(DEFAULT_EMAIL_INTEGRATION);
    await expect(fetchPlatformEmailIntegration()).resolves.toEqual(DEFAULT_EMAIL_INTEGRATION);
    expect(apiJsonMock).toHaveBeenLastCalledWith("/api/platform/email/integration", undefined);

    apiJsonMock.mockRejectedValueOnce(new Error("network"));
    await expect(fetchPlatformEmailIntegration()).resolves.toBeNull();
  });

  it("serializes optional SMTP fields on save and unwraps config on test", async () => {
    apiJsonMock.mockResolvedValueOnce(DEFAULT_EMAIL_INTEGRATION);
    await savePlatformEmailIntegration({
      ...DEFAULT_EMAIL_INTEGRATION,
      providerId: "custom_smtp",
      fromAddress: "ops@example.com",
      fromName: "Ops",
      smtpUsername: "ops",
      smtpHost: "smtp.example.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpPassword: "  s3cr3t  ",
    });
    expect(JSON.parse(apiJsonMock.mock.calls[0][1].body as string)).toEqual({
      providerId: "custom_smtp",
      fromAddress: "ops@example.com",
      fromName: "Ops",
      smtpUsername: "ops",
      smtpHost: "smtp.example.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpPassword: "s3cr3t",
    });

    apiJsonMock.mockResolvedValueOnce(DEFAULT_EMAIL_INTEGRATION);
    await savePlatformEmailIntegration({
      providerId: "gmail",
      fromAddress: "ops@gmail.com",
      fromName: "Ops",
      smtpUsername: "ops@gmail.com",
      connected: false,
      hasCredentials: true,
      smtpPassword: "   ",
    });
    expect(JSON.parse(apiJsonMock.mock.calls[1][1].body as string)).not.toHaveProperty(
      "smtpPassword",
    );

    apiJsonMock.mockResolvedValueOnce({ config: DEFAULT_EMAIL_INTEGRATION });
    await expect(testPlatformEmailIntegration()).resolves.toEqual(DEFAULT_EMAIL_INTEGRATION);
  });
});

describe("platformSmsIntegrationApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches SMS integration with or without an AbortSignal and returns null on failure", async () => {
    const controller = new AbortController();
    apiJsonMock.mockResolvedValueOnce(DEFAULT_SMS_INTEGRATION);
    await expect(fetchPlatformSmsIntegration(controller.signal)).resolves.toEqual(
      DEFAULT_SMS_INTEGRATION,
    );

    apiJsonMock.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchPlatformSmsIntegration()).resolves.toBeNull();
  });

  it("serializes optional SMS fields on save and sends testPhone on test", async () => {
    apiJsonMock.mockResolvedValueOnce(DEFAULT_SMS_INTEGRATION);
    await savePlatformSmsIntegration({
      ...DEFAULT_SMS_INTEGRATION,
      accountId: "AC123",
      senderId: "MMS",
      apiBaseUrl: "https://sms.example.com",
      accountSecret: "  tok_123  ",
    });
    expect(JSON.parse(apiJsonMock.mock.calls[0][1].body as string)).toEqual({
      providerId: DEFAULT_SMS_INTEGRATION.providerId,
      senderId: "MMS",
      accountId: "AC123",
      apiBaseUrl: "https://sms.example.com",
      accountSecret: "tok_123",
    });

    apiJsonMock.mockResolvedValueOnce({ config: DEFAULT_SMS_INTEGRATION });
    await expect(testPlatformSmsIntegration("+923001234567")).resolves.toEqual(
      DEFAULT_SMS_INTEGRATION,
    );
    expect(JSON.parse(apiJsonMock.mock.calls[1][1].body as string)).toEqual({
      testPhone: "+923001234567",
    });
  });
});
