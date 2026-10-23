import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WhatsAppIntegrationPanel from "./WhatsAppIntegrationPanel";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/whatsappIntegrationApi", () => ({
  fetchWhatsappIntegration: vi.fn().mockResolvedValue({
    providerId: "meta",
    accountId: "12345",
    phoneNumberId: "67890",
    senderId: "+15551234567",
    connected: true,
    hasCredentials: true,
  }),
  saveWhatsappIntegration: vi.fn().mockResolvedValue({}),
  testWhatsappIntegration: vi.fn().mockResolvedValue({}),
}));

describe("WhatsAppIntegrationPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders WhatsApp provider select and input fields", async () => {
    await act(async () => {
      root.render(<WhatsAppIntegrationPanel />);
    });

    const providerSelect = container.querySelector<HTMLSelectElement>("select#whatsapp-provider");
    expect(providerSelect).not.toBeNull();

    const accountInput = container.querySelector<HTMLInputElement>("input#whatsapp-account-id");
    expect(accountInput).not.toBeNull();

    const senderInput = container.querySelector<HTMLInputElement>("input#whatsapp-sender-id");
    expect(senderInput).not.toBeNull();

    const phoneIdInput = container.querySelector<HTMLInputElement>(
      "input#whatsapp-phone-number-id",
    );
    expect(phoneIdInput).not.toBeNull();

    const testPhoneInput = container.querySelector<HTMLInputElement>("input#whatsapp-test-phone");
    expect(testPhoneInput).not.toBeNull();
  });
});
