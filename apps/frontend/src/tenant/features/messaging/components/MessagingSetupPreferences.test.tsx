import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagingSetupPreferences } from "./MessagingSetupPreferences";
import { DEFAULT_MESSAGING_PREFERENCES } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockMutateAsync = vi.fn();
let mockPreferences = DEFAULT_MESSAGING_PREFERENCES;

vi.mock("../hooks/useMessagingSetupConfig", () => ({
  useMessagingPreferencesQuery: () => ({
    data: mockPreferences,
    isLoading: false,
  }),
  useMessagingPreferencesMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

let mockGateways = {
  sms: { isConfigured: true, isConnected: true, isLoading: false },
  whatsapp: { isConfigured: true, isConnected: true, isLoading: false },
  email: { isConfigured: true, isConnected: true, isLoading: false },
  isLoading: false,
  hasAnyGateway: true,
};

vi.mock("../hooks/useMessagingGatewaysStatus", () => ({
  useMessagingGatewaysStatus: () => mockGateways,
}));

vi.mock("./MessagingGatewayStatusOverview", () => ({
  MessagingGatewayStatusOverview: () => (
    <div data-testid="gateway-status-overview">Gateway Status Overview</div>
  ),
}));

vi.mock("@/components/app/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: ({ dirty }: { dirty: boolean }) => (
    <div data-testid="save-footer" data-dirty={dirty}>
      Save Footer
    </div>
  ),
}));

describe("MessagingSetupPreferences Component", () => {
  it("renders preferences card with inputs, select fields, and gateway overview", () => {
    const html = renderToStaticMarkup(<MessagingSetupPreferences canWrite={true} />);
    expect(html).toContain("messaging.preferences.title");
    expect(html).toContain("messaging.preferences.defaultChannel");
    expect(html).toContain("messaging.preferences.defaultSmsMode");
    expect(html).toContain("messaging.preferences.defaultCountryCode");
    expect(html).toContain("save-footer");
    expect(html).toContain("gateway-status-overview");
  });

  it("hides save footer when canWrite is false", () => {
    const html = renderToStaticMarkup(<MessagingSetupPreferences canWrite={false} />);
    expect(html).toContain("messaging.preferences.title");
    expect(html).not.toContain("save-footer");
  });

  it("displays advisory warning when default SMS mode is gateway but gateway is unconfigured", () => {
    mockPreferences = {
      ...DEFAULT_MESSAGING_PREFERENCES,
      defaultSmsMode: "gateway",
    };
    mockGateways = {
      ...mockGateways,
      sms: { isConfigured: false, isConnected: false, isLoading: false },
    };

    const html = renderToStaticMarkup(<MessagingSetupPreferences canWrite={true} />);
    expect(html).toContain("messaging.gateways.smsUnconfiguredWarning");
  });
});
