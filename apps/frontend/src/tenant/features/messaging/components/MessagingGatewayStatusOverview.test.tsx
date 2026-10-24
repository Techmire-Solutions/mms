import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagingGatewayStatusOverview } from "./MessagingGatewayStatusOverview";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("../hooks/useMessagingGatewaysStatus", () => ({
  useMessagingGatewaysStatus: () => ({
    sms: {
      isConfigured: true,
      isConnected: true,
      provider: "twilio",
      sender: "+14155552671",
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
  it("renders 3 gateway cards with respective statuses and provider names", () => {
    const html = renderToStaticMarkup(<MessagingGatewayStatusOverview />);
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

    // Links to settings
    expect(html).toContain('href="/settings?tab=sms"');
    expect(html).toContain('href="/settings?tab=whatsapp"');
    expect(html).toContain('href="/settings?tab=email"');
  });
});
