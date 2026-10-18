import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GoogleContactsPanel } from "./GoogleContactsPanel";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/contacts/hooks/useGoogleContactsSync", () => ({
  useGoogleContactsSync: () => ({
    isConnected: true,
    isConfigured: true,
    showSetup: false,
    setShowSetup: vi.fn(),
    error: "",
    setError: vi.fn(),
    form: { clientId: "id", clientSecret: "sec" },
    setForm: vi.fn(),
    handleSaveCredentials: vi.fn(),
    showAuthCode: false,
    authCode: "",
    setAuthCode: vi.fn(),
    exchanging: false,
    handleConnect: vi.fn(),
    handleExchangeCode: vi.fn(),
    syncing: false,
    syncResult: null,
    handleDisconnect: vi.fn(),
    handleSync: vi.fn(),
  }),
}));

vi.mock("./GoogleContactsConnectedState", () => ({
  GoogleContactsConnectedState: () => <div data-testid="connected-state">Connected State</div>,
}));

describe("GoogleContactsPanel Component", () => {
  it("renders panel and connected state", () => {
    const html = renderToStaticMarkup(<GoogleContactsPanel canWrite={true} />);

    expect(html).toContain("contacts.sync.googleTitle");
    expect(html).toContain("Connected State");
  });
});
