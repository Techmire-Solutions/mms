import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  sendTenantWhatsApp,
  verifyWhatsAppTransport,
} from "../services/whatsapp/whatsappService.js";
import * as whatsappIntegrationService from "../services/whatsapp/whatsappIntegrationService.js";
import * as globalSettingsService from "../services/globalSettingsService.js";
import * as outboundUrl from "../lib/outboundUrl.js";
import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_WHATSAPP_INTEGRATION } from "@mms/shared";

describe("whatsappService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns notifications_disabled when whatsAppNotifications is false", async () => {
    vi.spyOn(globalSettingsService, "loadGlobalSettings").mockResolvedValue({
      ...DEFAULT_GLOBAL_SETTINGS,
      whatsAppNotifications: false,
    });

    const result = await sendTenantWhatsApp({ to: "+1234567890", body: "Test" });
    expect(result).toEqual({ sent: false, reason: "notifications_disabled" });
  });

  it("returns not_configured when no credentials exist", async () => {
    vi.spyOn(globalSettingsService, "loadGlobalSettings").mockResolvedValue({
      ...DEFAULT_GLOBAL_SETTINGS,
      whatsAppNotifications: true,
    });
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationConfig").mockResolvedValue({
      ...DEFAULT_WHATSAPP_INTEGRATION,
      providerId: "meta",
      senderId: "+15551234567",
    });
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationSecrets").mockResolvedValue({});

    const result = await sendTenantWhatsApp({ to: "+1234567890", body: "Test" });
    expect(result).toEqual({ sent: false, reason: "not_configured" });
  });

  it("dispatches successfully via Meta Cloud API", async () => {
    vi.spyOn(globalSettingsService, "loadGlobalSettings").mockResolvedValue({
      ...DEFAULT_GLOBAL_SETTINGS,
      whatsAppNotifications: true,
    });
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationConfig").mockResolvedValue({
      ...DEFAULT_WHATSAPP_INTEGRATION,
      providerId: "meta",
      phoneNumberId: "123456",
      senderId: "+15551234567",
    });
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationSecrets").mockResolvedValue({
      accountSecret: "meta-access-token",
    });

    vi.spyOn(outboundUrl, "fetchSafeExternal").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid-123" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await sendTenantWhatsApp({ to: "+1234567890", body: "Test Hello" });
    expect(result).toEqual({ sent: true, providerMessageId: "wamid-123" });
  });

  it("dispatches successfully via Twilio WhatsApp", async () => {
    vi.spyOn(globalSettingsService, "loadGlobalSettings").mockResolvedValue({
      ...DEFAULT_GLOBAL_SETTINGS,
      whatsAppNotifications: true,
    });
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationConfig").mockResolvedValue({
      ...DEFAULT_WHATSAPP_INTEGRATION,
      providerId: "twilio",
      accountId: "AC123456",
      senderId: "whatsapp:+14155238886",
    });
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationSecrets").mockResolvedValue({
      accountSecret: "twilio-auth-token",
    });

    vi.spyOn(outboundUrl, "fetchSafeExternal").mockResolvedValue(
      new Response(JSON.stringify({ sid: "SM123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await sendTenantWhatsApp({ to: "+1234567890", body: "Test Twilio" });
    expect(result).toEqual({ sent: true, providerMessageId: "SM123" });
  });

  it("dispatches successfully via Generic / Custom URL provider", async () => {
    vi.spyOn(globalSettingsService, "loadGlobalSettings").mockResolvedValue({
      ...DEFAULT_GLOBAL_SETTINGS,
      whatsAppNotifications: true,
    });
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationConfig").mockResolvedValue({
      ...DEFAULT_WHATSAPP_INTEGRATION,
      providerId: "custom",
      senderId: "+923001234567",
      apiBaseUrl: "https://logiqueues.com/gateway/v1/messages/smart",
    });
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationSecrets").mockResolvedValue({
      accountSecret: "ngw_live_test_key",
    });

    const fetchSpy = vi.spyOn(outboundUrl, "fetchSafeExternal").mockResolvedValue(
      new Response(JSON.stringify({ id: "wa_custom_123" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await sendTenantWhatsApp({ to: "+923001234567", body: "Test generic WhatsApp" });
    expect(result).toEqual({ sent: true, providerMessageId: "wa_custom_123" });
    expect(fetchSpy.mock.calls[0][0]).toBe("https://logiqueues.com/gateway/v1/messages/smart");
  });

  it("verifies transport connectivity check", async () => {
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationConfig").mockResolvedValue({
      ...DEFAULT_WHATSAPP_INTEGRATION,
      providerId: "meta",
      phoneNumberId: "123456",
      senderId: "+15551234567",
    });
    vi.spyOn(whatsappIntegrationService, "loadWhatsappIntegrationSecrets").mockResolvedValue({
      accountSecret: "meta-access-token",
    });

    vi.spyOn(outboundUrl, "fetchSafeExternal").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid-test" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await verifyWhatsAppTransport("+1234567890");
    expect(result.sent).toBe(true);
  });
});
