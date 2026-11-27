import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EMAIL_INTEGRATION, type EmailIntegrationConfig } from "@mms/contracts";
import type { EmailIntegrationApi } from "@mms/ui/app/IntegrationPanels/types";
import { EmailIntegrationPanel } from "./EmailIntegrationPanel";

const notifyMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mms/fe-core/notify", () => ({
  notify: notifyMock,
}));

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

const VALID_CUSTOM_CONFIG: EmailIntegrationConfig = {
  ...DEFAULT_EMAIL_INTEGRATION,
  providerId: "custom_smtp",
  fromName: "Madrasa Ops",
  fromAddress: "ops@example.com",
  smtpUsername: "ops-user",
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpSecure: false,
  hasCredentials: true,
  connected: false,
  lastTestOk: false,
};

describe("EmailIntegrationPanel", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  const findButton = (label: string): HTMLButtonElement => {
    const button = Array.from(container.querySelectorAll("button")).find((el) =>
      el.textContent?.includes(label),
    );
    if (!button) throw new Error(`Missing button: ${label}`);
    return button;
  };

  it("loads custom SMTP config, renders host/port/test inputs, and validates before saving", async () => {
    const api: EmailIntegrationApi = {
      fetchConfig: vi.fn().mockResolvedValue(VALID_CUSTOM_CONFIG),
      saveConfig: vi.fn(),
      testConfig: vi.fn(),
    };
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <EmailIntegrationPanel
          api={api}
          idPrefix="platform-"
          showTestTargetInput
          seedTestTarget={(cfg) => cfg.fromAddress ?? ""}
        />,
      );
    });

    const hostInput = container.querySelector("#platform-email-smtp-host") as HTMLInputElement;
    const portInput = container.querySelector("#platform-email-smtp-port") as HTMLInputElement;
    const testInput = container.querySelector("#platform-email-test-email") as HTMLInputElement;
    const fromInput = container.querySelector("#platform-email-from-address") as HTMLInputElement;

    expect(hostInput.value).toBe("smtp.example.com");
    expect(portInput.value).toBe("587");
    expect(testInput.value).toBe("ops@example.com");

    await act(async () => {
      changeInput(fromInput, "not-an-email");
    });
    await act(async () => {
      findButton("email.saveConnection").click();
    });

    expect(api.saveConfig).not.toHaveBeenCalled();
    expect(container.textContent).toContain("email.invalidFromAddress");

    await act(async () => {
      findButton("email.sendTest").click();
    });
    expect(api.testConfig).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it("saves edited SMTP fields, clears password, and sends test with dirty credentials", async () => {
    const savedConfig: EmailIntegrationConfig = {
      ...VALID_CUSTOM_CONFIG,
      fromName: "Updated Ops",
    };
    const api: EmailIntegrationApi = {
      fetchConfig: vi.fn().mockResolvedValue(VALID_CUSTOM_CONFIG),
      saveConfig: vi.fn().mockResolvedValue(savedConfig),
      testConfig: vi.fn().mockResolvedValue({ ...savedConfig, lastTestOk: true }),
    };
    const onConfigSaved = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <EmailIntegrationPanel
          api={api}
          showTestTargetInput
          onConfigSaved={onConfigSaved}
          resolveTestTarget={(_cfg, target) => target.trim() || undefined}
        />,
      );
    });

    const fromNameInput = container.querySelector("#email-from-name") as HTMLInputElement;
    const usernameInput = container.querySelector("#email-smtp-username") as HTMLInputElement;
    const hostInput = container.querySelector("#email-smtp-host") as HTMLInputElement;
    const portInput = container.querySelector("#email-smtp-port") as HTMLInputElement;
    const passwordInput = container.querySelector("#email-smtp-password") as HTMLInputElement;
    const testEmailInput = container.querySelector("#email-test-email") as HTMLInputElement;

    await act(async () => {
      changeInput(fromNameInput, "Updated Ops");
      changeInput(usernameInput, "updated-user");
      changeInput(hostInput, "mail.example.com");
      changeInput(portInput, "465");
      changeInput(passwordInput, "  new-secret  ");
      changeInput(testEmailInput, "verify@example.com");
    });

    await act(async () => {
      findButton("email.saveConnection").click();
    });

    expect(api.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        fromName: "Updated Ops",
        smtpUsername: "updated-user",
        smtpHost: "mail.example.com",
        smtpPort: 465,
        smtpPassword: "new-secret",
      }),
    );
    expect(passwordInput.value).toBe("");
    expect(onConfigSaved).toHaveBeenCalledWith(savedConfig);
    expect(notifyMock.success).toHaveBeenCalledWith("email.saveSuccess", {
      description: "email.saveSuccessDesc",
    });

    await act(async () => {
      changeInput(passwordInput, "rotated-secret");
    });
    await act(async () => {
      findButton("email.sendTest").click();
    });

    expect(api.saveConfig).toHaveBeenCalledTimes(2);
    expect(api.testConfig).toHaveBeenCalledWith("verify@example.com");
    expect(notifyMock.success).toHaveBeenCalledWith("email.testSuccess", {
      description: "email.testSuccessDesc",
    });

    act(() => root.unmount());
  });

  it("handles save/test failures and respects read-only gating", async () => {
    const api: EmailIntegrationApi = {
      fetchConfig: vi.fn().mockResolvedValue(VALID_CUSTOM_CONFIG),
      saveConfig: vi.fn().mockRejectedValue(new Error("SMTP refused")),
      testConfig: vi.fn().mockRejectedValue(new Error("Relay denied")),
    };
    const resolveActionError = vi.fn().mockReturnValue({
      inlineMessage: "inline-smtp-error",
      description: "mapped-desc",
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(<EmailIntegrationPanel api={api} resolveActionError={resolveActionError} />);
    });

    await act(async () => {
      findButton("email.saveConnection").click();
    });
    expect(notifyMock.error).toHaveBeenCalledWith("email.saveFailed", {
      description: "mapped-desc",
    });
    expect(container.textContent).toContain("inline-smtp-error");

    await act(async () => {
      root.render(<EmailIntegrationPanel api={api} />);
    });
    await act(async () => {
      findButton("email.sendTest").click();
    });
    expect(notifyMock.error).toHaveBeenCalledWith("email.testFailed", {
      description: "Relay denied",
    });

    await act(async () => {
      root.render(<EmailIntegrationPanel api={api} canWrite={false} />);
    });
    expect(findButton("email.saveConnection").disabled).toBe(true);
    expect(findButton("email.sendTest").disabled).toBe(true);

    act(() => root.unmount());
  });
});
