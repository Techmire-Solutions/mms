import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SMS_INTEGRATION,
  listSmsProviderPresets,
  type SmsIntegrationConfig,
} from "@mms/contracts";
import type { SmsIntegrationApi } from "@mms/ui/app/IntegrationPanels/types";
import { SmsIntegrationPanel } from "./SmsIntegrationPanel";

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

const presets = listSmsProviderPresets();
const baseUrlPreset = presets.find((p) => p.requiresBaseUrl) ?? presets[0];

const VALID_SMS_CONFIG: SmsIntegrationConfig = {
  ...DEFAULT_SMS_INTEGRATION,
  providerId: baseUrlPreset.id,
  accountId: "AC99887766",
  senderId: "MADRASA",
  apiBaseUrl: baseUrlPreset.requiresBaseUrl ? "https://sms.example.com/v1" : undefined,
  hasCredentials: true,
  connected: false,
  lastTestOk: false,
};

describe("SmsIntegrationPanel", () => {
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

  it("renders loaded SMS config, validates required fields, and guards blank test recipient", async () => {
    const api: SmsIntegrationApi = {
      fetchConfig: vi.fn().mockResolvedValue(VALID_SMS_CONFIG),
      saveConfig: vi.fn(),
      testConfig: vi.fn(),
    };
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SmsIntegrationPanel
          api={api}
          idPrefix="platform-"
          testTargetRequiredKey="sms.invalidTestPhone"
        />,
      );
    });

    expect((container.querySelector("#platform-sms-account-id") as HTMLInputElement).value).toBe(
      "AC99887766",
    );

    await act(async () => {
      findButton("sms.sendTest").click();
    });
    expect(notifyMock.error).toHaveBeenCalledWith("sms.invalidTestPhone");
    expect(api.testConfig).not.toHaveBeenCalled();

    const baseUrlOrSenderInput = (container.querySelector("#platform-sms-api-base-url") ??
      container.querySelector("#platform-sms-sender-id")) as HTMLInputElement;
    await act(async () => {
      changeInput(baseUrlOrSenderInput, "not-a-valid-url");
    });
    await act(async () => {
      findButton("sms.saveConnection").click();
    });
    expect(api.saveConfig).not.toHaveBeenCalled();
    expect(container.textContent).toContain("sms.invalidBaseUrl");

    act(() => root.unmount());
  });

  it("saves config with prepareSaveConfig and runs test send after persisting dirty secret", async () => {
    const savedConfig: SmsIntegrationConfig = {
      ...VALID_SMS_CONFIG,
      senderId: "MMSALERT",
    };
    const api: SmsIntegrationApi = {
      fetchConfig: vi.fn().mockResolvedValue(VALID_SMS_CONFIG),
      saveConfig: vi.fn().mockResolvedValue(savedConfig),
      testConfig: vi.fn().mockResolvedValue({ ...savedConfig, lastTestOk: true }),
    };
    const onConfigSaved = vi.fn();
    const prepareSaveConfig = vi.fn((cfg: SmsIntegrationConfig, secret: string) => ({
      ...cfg,
      accountSecret: secret.trim() || undefined,
    }));
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SmsIntegrationPanel
          api={api}
          seedTestTarget={() => "+923001234567"}
          prepareSaveConfig={prepareSaveConfig}
          onConfigSaved={onConfigSaved}
          validateTestTarget
        />,
      );
    });

    const accountInput = container.querySelector("#sms-account-id") as HTMLInputElement;
    const senderInput = container.querySelector("#sms-sender-id") as HTMLInputElement;
    const secretInput = container.querySelector("#sms-account-secret") as HTMLInputElement;
    const baseUrlInput = container.querySelector("#sms-api-base-url") as HTMLInputElement | null;

    await act(async () => {
      changeInput(accountInput, "AC11223344");
      changeInput(senderInput, "MMSALERT");
      changeInput(secretInput, "  sec_live_1  ");
      if (baseUrlInput) changeInput(baseUrlInput, "https://gateway.example.com/sms");
    });

    await act(async () => {
      findButton("sms.saveConnection").click();
    });

    expect(prepareSaveConfig).toHaveBeenCalled();
    expect(api.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "AC11223344",
        senderId: "MMSALERT",
        accountSecret: "sec_live_1",
      }),
    );
    expect(secretInput.value).toBe("");
    expect(onConfigSaved).toHaveBeenCalledWith(savedConfig);
    expect(notifyMock.success).toHaveBeenCalledWith("sms.saveSuccess", {
      description: "sms.saveSuccessDesc",
    });

    await act(async () => {
      changeInput(secretInput, "sec_live_2");
    });
    await act(async () => {
      findButton("sms.sendTest").click();
    });

    expect(api.saveConfig).toHaveBeenCalledTimes(2);
    expect(api.testConfig).toHaveBeenCalledWith("+923001234567");
    expect(notifyMock.success).toHaveBeenCalledWith("sms.testSuccess", {
      description: "sms.testSuccessDesc",
    });

    act(() => root.unmount());
  });

  it("reports save/test errors and honors disableTest and read-only states", async () => {
    const api: SmsIntegrationApi = {
      fetchConfig: vi.fn().mockResolvedValue(VALID_SMS_CONFIG),
      saveConfig: vi.fn().mockRejectedValue(new Error("Gateway down")),
      testConfig: vi.fn().mockRejectedValue(new Error("Carrier rejected")),
    };
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SmsIntegrationPanel
          api={api}
          disableTest={(phone) => phone.trim().length === 0}
          resolveActionError={(_err, key) => ({ inlineMessage: `err:${key}`, description: "desc" })}
        />,
      );
    });

    expect(findButton("sms.sendTest").disabled).toBe(true);

    await act(async () => {
      findButton("sms.saveConnection").click();
    });
    expect(notifyMock.error).toHaveBeenCalledWith("sms.saveFailed", { description: "desc" });

    const phoneInput = container.querySelector("#sms-test-phone") as HTMLInputElement;
    await act(async () => {
      changeInput(phoneInput, "+923009998887");
    });
    expect(findButton("sms.sendTest").disabled).toBe(false);

    await act(async () => {
      findButton("sms.sendTest").click();
    });
    expect(notifyMock.error).toHaveBeenCalledWith("sms.testFailed", { description: "desc" });

    await act(async () => {
      root.render(<SmsIntegrationPanel api={api} canWrite={false} />);
    });
    expect(findButton("sms.saveConnection").disabled).toBe(true);
    expect(findButton("sms.sendTest").disabled).toBe(true);

    act(() => root.unmount());
  });
});
