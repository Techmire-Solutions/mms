import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmailIntegrationPanel from "./EmailIntegrationPanel";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

const mockFetchEmailIntegration = vi.fn().mockResolvedValue({
  providerId: "gmail",
  fromName: "Admin",
  fromAddress: "admin@example.com",
  smtpUsername: "admin@example.com",
  smtpHost: "smtp.gmail.com",
  smtpPort: 465,
  smtpSecure: true,
  connected: true,
  hasCredentials: true,
});
const mockSaveEmailIntegration = vi.fn().mockResolvedValue({});
const mockTestEmailIntegration = vi.fn().mockResolvedValue({});

vi.mock("../lib/emailIntegrationApi", () => ({
  fetchEmailIntegration: () => mockFetchEmailIntegration(),
  saveEmailIntegration: (args: unknown) => mockSaveEmailIntegration(args),
  testEmailIntegration: (args: unknown) => mockTestEmailIntegration(args),
}));

describe("EmailIntegrationPanel", () => {
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

  it("renders Email provider select, input fields, and recipient test email input", async () => {
    await act(async () => {
      root.render(<EmailIntegrationPanel />);
    });

    const providerSelect = container.querySelector<HTMLSelectElement>("select#email-provider");
    expect(providerSelect).not.toBeNull();

    const fromNameInput = container.querySelector<HTMLInputElement>("input#email-from-name");
    expect(fromNameInput).not.toBeNull();

    const fromAddressInput = container.querySelector<HTMLInputElement>("input#email-from-address");
    expect(fromAddressInput).not.toBeNull();

    const testEmailInput = container.querySelector<HTMLInputElement>("input#email-test-email");
    expect(testEmailInput).not.toBeNull();
  });

  it("invokes testEmailIntegration with specified test email address", async () => {
    await act(async () => {
      root.render(<EmailIntegrationPanel />);
    });

    const testEmailInput = container.querySelector<HTMLInputElement>("input#email-test-email");
    expect(testEmailInput).not.toBeNull();

    await act(async () => {
      if (testEmailInput) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(testEmailInput, "target@example.com");
        testEmailInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    const testButton = buttons.find((btn) => btn.textContent?.includes("email.sendTest"));
    expect(testButton).toBeDefined();

    await act(async () => {
      testButton?.click();
    });

    expect(mockTestEmailIntegration).toHaveBeenCalledWith("target@example.com");
  });
});
