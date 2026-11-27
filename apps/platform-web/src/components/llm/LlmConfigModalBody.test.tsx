import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import { formatLlmSpeed, type LlmConfig } from "@mms/contracts";
import { LlmConfigModalBody, type LlmConfigModalBodyProps } from "./LlmConfigModalBody";

const t = ((key: string) => key) as unknown as TranslationFunction;

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function makeProps(overrides: Partial<LlmConfigModalBodyProps> = {}): LlmConfigModalBodyProps {
  return {
    editingConfig: null,
    formName: "Gemini",
    setFormName: vi.fn(),
    formProvider: "gemini",
    setFormProvider: vi.fn(),
    formModel: "gemini-2.5-flash",
    setFormModel: vi.fn(),
    formBaseUrl: "",
    setFormBaseUrl: vi.fn(),
    formApiKey: "",
    setFormApiKey: vi.fn(),
    formIsDefaultText: false,
    setFormIsDefaultText: vi.fn(),
    formTemperature: 0.7,
    setFormTemperature: vi.fn(),
    formMaxTokens: 2048,
    setFormMaxTokens: vi.fn(),
    formTopP: 0.9,
    setFormTopP: vi.fn(),
    fetchedModels: [],
    fetchingModels: false,
    showCustomModelInput: false,
    setShowCustomModelInput: vi.fn(),
    selectedProviderDefaultModel: "gemini-2.5-flash",
    modalTestResult: null,
    modalTesting: false,
    handleModalTestConnection: vi.fn().mockResolvedValue(undefined),
    formatLlmSpeed,
    t,
    ...overrides,
  };
}

describe("LlmConfigModalBody", () => {
  it("disables draft test when creating without API key and updates name/model/url/key inputs", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const props = makeProps();

    await act(async () => {
      root.render(<LlmConfigModalBody {...props} />);
    });

    const testBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("settings.llmModalTestDraft"),
    ) as HTMLButtonElement;
    expect(testBtn.disabled).toBe(true);

    await act(async () => {
      changeInput(container.querySelector("#configName") as HTMLInputElement, "Custom LLM");
      changeInput(container.querySelector("#model") as HTMLInputElement, "gemini-2.5-pro");
      changeInput(
        container.querySelector("#baseUrl") as HTMLInputElement,
        "https://proxy.example.com",
      );
      changeInput(container.querySelector("#apiKey") as HTMLInputElement, "sk-123");
    });

    expect(props.setFormName).toHaveBeenCalledWith("Custom LLM");
    expect(props.setFormModel).toHaveBeenCalledWith("gemini-2.5-pro");
    expect(props.setFormBaseUrl).toHaveBeenCalledWith("https://proxy.example.com");
    expect(props.setFormApiKey).toHaveBeenCalledWith("sk-123");

    act(() => root.unmount());
    container.remove();
  });

  it("renders fetched model selector toggle, test result banners, and enables test when editing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const editingConfig: LlmConfig = {
      id: "cfg-1",
      name: "Saved",
      provider: "openai",
      model: "gpt-4o",
      apiKey: "masked",
      isDefaultText: true,
    };
    const props = makeProps({
      editingConfig,
      fetchedModels: ["gpt-4o", "gpt-4.1-mini"],
      fetchingModels: true,
      modalTestResult: {
        success: true,
        message: "Connected",
        response: "Salam",
      },
    });

    await act(async () => {
      root.render(<LlmConfigModalBody {...props} />);
    });

    const toggleManualBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("settings.llmModalTypeManually"),
    ) as HTMLButtonElement;
    await act(async () => {
      toggleManualBtn.click();
    });
    expect(props.setShowCustomModelInput).toHaveBeenCalledWith(true);

    const testBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("settings.llmModalTestDraft"),
    ) as HTMLButtonElement;
    expect(testBtn.disabled).toBe(false);
    await act(async () => {
      testBtn.click();
    });
    expect(props.handleModalTestConnection).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("settings.llmTestSuccess");

    await act(async () => {
      root.render(
        <LlmConfigModalBody
          {...props}
          showCustomModelInput
          modalTesting
          modalTestResult={{ success: false, message: "Invalid key" }}
        />,
      );
    });
    expect(container.textContent).toContain("Invalid key");

    act(() => root.unmount());
    container.remove();
  });
});
