import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { LlmConfig, PlatformSettings } from "@mms/contracts";
import { withQueryClient } from "@/test/queryClientTestUtils";
import { usePlatformLlmModels, useTestPlatformLlm, useUpdatePlatformLlm } from "./usePlatformLlm";
import { usePlatformLlmSettingsController } from "./usePlatformLlmSettingsController";

const apiContractMock = vi.hoisted(() => ({
  platform: {
    updateLlm: vi.fn(),
    testLlm: vi.fn(),
    getLlmModels: vi.fn(),
  },
}));

const notifyMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiContract: apiContractMock }));
vi.mock("@/lib/notify", () => ({ notify: notifyMock }));
vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/platform/features/auth/lib/platformAuthErrors", () => ({
  getPlatformErrorMessage: (error: Error) => error.message,
}));

const BASE_CONFIG: LlmConfig = {
  id: "cfg-1",
  name: "Gemini Primary",
  provider: "gemini",
  model: "gemini-2.5-flash",
  apiKey: "sk-saved",
  isDefaultText: true,
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
};

const BASE_SETTINGS = {
  llmProvider: "gemini",
  llmApiKey: "legacy-key",
  llmConfigs: [BASE_CONFIG],
  updatedAt: "2026-05-01T00:00:00.000Z",
} as unknown as PlatformSettings;

function renderWithClient<T>(hook: () => T) {
  let result!: T;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Probe() {
    result = hook();
    return null;
  }

  act(() => {
    root.render(withQueryClient(<Probe />, client));
  });

  return {
    getResult: () => result,
    rerender: () => {
      act(() => root.render(withQueryClient(<Probe />, client)));
    },
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("usePlatformLlm hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles update, test, and model listing responses across 200 and error statuses", async () => {
    apiContractMock.platform.updateLlm.mockResolvedValueOnce({
      status: 200,
      body: { settings: BASE_SETTINGS },
    });
    const update = renderWithClient(useUpdatePlatformLlm);
    await expect(
      update.getResult().mutateAsync({ llmProvider: "gemini", llmApiKey: "", llmConfigs: [] }),
    ).resolves.toEqual(BASE_SETTINGS);

    apiContractMock.platform.updateLlm.mockResolvedValueOnce({
      status: 400,
      body: { message: "Bad LLM payload" },
    });
    await expect(
      update.getResult().mutateAsync({ llmProvider: "gemini", llmApiKey: "", llmConfigs: [] }),
    ).rejects.toThrow("Bad LLM payload");
    expect(notifyMock.error).toHaveBeenCalledWith("Bad LLM payload");
    update.cleanup();

    const testHook = renderWithClient(useTestPlatformLlm);
    apiContractMock.platform.testLlm.mockResolvedValueOnce({
      status: 200,
      body: { success: true, message: "OK" },
    });
    await expect(testHook.getResult().mutateAsync({ configId: "cfg-1" })).resolves.toEqual({
      success: true,
      message: "OK",
    });

    apiContractMock.platform.testLlm.mockResolvedValueOnce({
      status: 502,
      body: { message: "Upstream timeout" },
    });
    await expect(testHook.getResult().mutateAsync({ configId: "cfg-1" })).resolves.toEqual({
      success: false,
      message: "Upstream timeout",
    });
    testHook.cleanup();

    const modelsHook = renderWithClient(usePlatformLlmModels);
    apiContractMock.platform.getLlmModels.mockResolvedValueOnce({
      status: 200,
      body: { models: ["gemini-2.5-pro"] },
    });
    await expect(modelsHook.getResult().mutateAsync({ provider: "gemini" })).resolves.toEqual([
      "gemini-2.5-pro",
    ]);

    apiContractMock.platform.getLlmModels.mockResolvedValueOnce({ status: 500, body: {} });
    await expect(modelsHook.getResult().mutateAsync({ provider: "gemini" })).resolves.toEqual([]);
    modelsHook.cleanup();
  });
});

describe("usePlatformLlmSettingsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("manages modal add/edit/delete, debounced model fetch, connection tests, save, and discard", async () => {
    apiContractMock.platform.getLlmModels.mockResolvedValue({
      status: 200,
      body: { models: ["gpt-4.1-mini", "gpt-4o"] },
    });

    const { getResult, cleanup } = renderWithClient(() =>
      usePlatformLlmSettingsController(BASE_SETTINGS),
    );
    expect(getResult().listProps.configs).toEqual([BASE_CONFIG]);
    expect(getResult().isDirty).toBe(false);

    act(() => getResult().listProps.openAddModal());
    expect(getResult().modalProps.modalOpen).toBe(true);

    act(() => getResult().modalProps.handleSaveModalConfig());
    expect(getResult().modalProps.modalError).toBe("common.fieldRequired");

    act(() => {
      getResult().modalProps.setFormProvider("openai");
      getResult().modalProps.setFormName("OpenAI Backup");
      getResult().modalProps.setFormApiKey("sk-openai-live");
      getResult().modalProps.setFormBaseUrl("https://api.openai.com/v1");
      getResult().modalProps.setFormIsDefaultText(true);
      getResult().modalProps.setFormTemperature(0.4);
      getResult().modalProps.setFormMaxTokens(4096);
      getResult().modalProps.setFormTopP(0.8);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(850);
    });
    expect(getResult().modalProps.fetchedModels).toEqual(["gpt-4.1-mini", "gpt-4o"]);

    apiContractMock.platform.testLlm.mockResolvedValueOnce({
      status: 200,
      body: { success: true, message: "Modal verified" },
    });
    await act(async () => {
      await getResult().modalProps.handleModalTestConnection();
    });
    expect(getResult().modalProps.modalTestResult).toEqual({
      success: true,
      message: "Modal verified",
    });

    act(() => getResult().modalProps.handleSaveModalConfig());
    expect(getResult().modalProps.modalOpen).toBe(false);
    expect(getResult().listProps.configs).toHaveLength(2);
    expect(getResult().isDirty).toBe(true);

    act(() => getResult().listProps.openEditModal(BASE_CONFIG));
    act(() => getResult().modalProps.setFormName("Gemini Updated"));
    act(() => getResult().modalProps.handleSaveModalConfig());
    expect(getResult().listProps.configs[0].name).toBe("Gemini Updated");

    apiContractMock.platform.testLlm
      .mockResolvedValueOnce({ status: 200, body: { success: true, message: "Fast" } })
      .mockResolvedValueOnce({ status: 200, body: { success: false, message: "Rejected" } });
    await act(async () => {
      await getResult().listProps.handleTestConnection("cfg-1");
    });
    expect(getResult().listProps.healthStatuses["cfg-1"]).toBe("verified");

    await act(async () => {
      await getResult().listProps.handleTestConnection("cfg-1");
    });
    expect(getResult().listProps.healthStatuses["cfg-1"]).toBe("failed");

    apiContractMock.platform.updateLlm.mockResolvedValueOnce({
      status: 200,
      body: { settings: BASE_SETTINGS },
    });
    await act(async () => {
      await getResult().handleSave();
    });
    expect(apiContractMock.platform.updateLlm).toHaveBeenCalledWith({
      body: expect.objectContaining({
        expectedUpdatedAt: "2026-05-01T00:00:00.000Z",
      }),
    });

    act(() => getResult().listProps.handleDeleteConfig("cfg-1"));
    expect(getResult().listProps.configs).toHaveLength(1);

    act(() => getResult().handleDiscard());
    expect(getResult().listProps.configs).toEqual([BASE_CONFIG]);
    cleanup();
  });
});
