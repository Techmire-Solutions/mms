import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagingGatewayStatusOverview } from "./MessagingGatewayStatusOverview";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    emailNotifications: true,
    smsNotifications: true,
    whatsAppNotifications: false,
  }),
}));

vi.mock("@/lib/db", () => ({
  getGlobalSettings: () => ({
    emailNotifications: true,
    smsNotifications: true,
    whatsAppNotifications: false,
  }),
  saveGlobalSettingsAsync: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("./SmsIntegrationPanel", () => ({
  default: () => <div data-testid="sms-integration-panel">SMS Panel</div>,
}));

vi.mock("./WhatsAppIntegrationPanel", () => ({
  default: () => <div data-testid="whatsapp-integration-panel">WhatsApp Panel</div>,
}));

vi.mock("./EmailIntegrationPanel", () => ({
  default: () => <div data-testid="email-integration-panel">Email Panel</div>,
}));

vi.mock("../hooks/useMessagingGatewaysStatus", () => ({
  useMessagingGatewaysStatus: () => ({
    sms: {
      isConfigured: true,
      isConnected: true,
      provider: "twilio",
      sender: "+14155552671",
      lastTestOk: false,
      lastError: "Authentication failed (401)",
      isLoading: false,
    },
    whatsapp: {
      isConfigured: false,
      isConnected: false,
      provider: undefined,
      sender: undefined,
      isLoading: false,
    },
    email: {
      isConfigured: true,
      isConnected: false,
      provider: "sendgrid",
      sender: "no-reply@madrasa.org",
      isLoading: false,
    },
    isLoading: false,
    hasAnyGateway: true,
  }),
}));

describe("MessagingGatewayStatusOverview Component", () => {
  it("renders 3 gateway cards with respective statuses, provider names, and inline configuration", () => {
    const html = renderToStaticMarkup(<MessagingGatewayStatusOverview canWrite={true} />);
    expect(html).toContain("messaging.gateways.title");
    expect(html).toContain("messaging.channel.sms");
    expect(html).toContain("messaging.channel.whatsapp");
    expect(html).toContain("messaging.channel.email");

    // SMS is connected
    expect(html).toContain("messaging.gateways.connected");
    expect(html).toContain("twilio");
    expect(html).toContain("+14155552671");

    // WhatsApp is not configured
    expect(html).toContain("messaging.gateways.notConfigured");

    // Email is configured but not connected
    expect(html).toContain("messaging.gateways.configured");
    expect(html).toContain("sendgrid");
    expect(html).toContain("no-reply@madrasa.org");

    // Verify inline configure gateway buttons exist
    expect(html).toContain("messaging.gateways.configureGateway");

    // No longer links out to settings
    expect(html).not.toContain('href="/settings?tab=global"');

    // Inline integration panel for default selected channel (sms) is mounted
    expect(html).toContain('data-testid="sms-integration-panel"');
    expect(html).toContain("global.smsNotifications");
  });

  it("surfaces the last gateway error instead of implying the channel is healthy", () => {
    const html = renderToStaticMarkup(<MessagingGatewayStatusOverview canWrite={true} />);

    // The card surfaces error detail
    expect(html).toContain("messaging.gateways.lastError");
    expect(html).toContain("Authentication failed (401)");
  });
});
