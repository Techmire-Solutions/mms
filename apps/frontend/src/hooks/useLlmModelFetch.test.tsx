import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmConfig, LlmProviderType } from "@mms/shared";
import { useLlmModelFetch, type LlmModelFetcher } from "./useLlmModelFetch";

const { modelsMock } = vi.hoisted(() => ({ modelsMock: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiContract: {
    ai: { models: modelsMock },
  },
}));

interface ModelsResponse {
  status: number;
  body: { success: boolean; models: string[] };
  headers: Headers;
}

interface ModelFetchResult {
  fetchedModels: string[];
  fetchingModels: boolean;
  showCustomModelInput: boolean;
  setShowCustomModelInput: (value: boolean) => void;
  clearFetchedModels: () => void;
}

interface HarnessOptions {
  formApiKey: string;
  formProvider: LlmProviderType;
  formBaseUrl: string;
  formModel: string;
  modalOpen: boolean;
  editingConfig: LlmConfig | null;
  setFormModel: (value: string) => void;
  fetchModels?: LlmModelFetcher;
}

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function modelsResponse(models: string[]): ModelsResponse {
  return { status: 200, body: { success: true, models }, headers: new Headers() };
}

const editingConfig: LlmConfig = {
  id: "cfg-1",
  name: "Saved config",
  provider: "gemini",
  apiKey: "saved-key",
  model: "gemini-2.0-flash",
  isDefaultText: false,
};

describe("useLlmModelFetch", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: ModelFetchResult | null;
  let setFormModelMock: (value: string) => void;

  function Harness(options: HarnessOptions): null {
    setFormModelMock = options.setFormModel;
    result = useLlmModelFetch(options);
    return null;
  }

  function defaultOptions(overrides: Partial<HarnessOptions> = {}): HarnessOptions {
    return {
      formApiKey: "key-1",
      formProvider: "gemini",
      formBaseUrl: "",
      formModel: "",
      modalOpen: true,
      editingConfig: null,
      setFormModel: setFormModelMock,
      ...overrides,
    };
  }

  async function renderHarness(options: HarnessOptions): Promise<void> {
    await act(async () => {
      root.render(<Harness {...options} />);
    });
  }

  async function settleDebounce(): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    result = null;
    setFormModelMock = vi.fn();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    modelsMock.mockReset();
    vi.useRealTimers();
  });

  it("debounces and fetches models for a typed API key, then defaults the model", async () => {
    // Arrange
    modelsMock.mockResolvedValue(modelsResponse(["alpha", "beta"]));

    // Act
    await renderHarness(defaultOptions({ formApiKey: " key-1 " }));

    // Assert — debounce window: nothing requested yet.
    expect(modelsMock).not.toHaveBeenCalled();
    expect(result?.fetchedModels).toEqual([]);

    await settleDebounce();

    // Assert — the trimmed key reaches the request and the list + default land.
    expect(modelsMock).toHaveBeenCalledTimes(1);
    expect(modelsMock.mock.calls[0]?.[0]?.body?.apiKey).toBe("key-1");
    expect(result?.fetchedModels).toEqual(["alpha", "beta"]);
    expect(setFormModelMock).toHaveBeenCalled();
  });

  it("aborts the in-flight fetch when inputs change and ignores its late response", async () => {
    // Arrange
    let resolveFirst: (value: ModelsResponse) => void = () => undefined;
    let resolveSecond: (value: ModelsResponse) => void = () => undefined;
    modelsMock
      .mockReturnValueOnce(new Promise<ModelsResponse>((resolve) => (resolveFirst = resolve)))
      .mockReturnValueOnce(new Promise<ModelsResponse>((resolve) => (resolveSecond = resolve)));

    await renderHarness(defaultOptions());
    await settleDebounce();
    expect(modelsMock).toHaveBeenCalledTimes(1);

    // Act — provider switch must abort the first request.
    await renderHarness(defaultOptions({ formProvider: "openai" }));

    // Assert — first request aborted.
    const firstCall = modelsMock.mock.calls[0]?.[0] as
      { signal?: AbortSignal; body?: Record<string, unknown> } | undefined;
    expect(firstCall?.signal?.aborted).toBe(true);

    await settleDebounce();
    expect(modelsMock).toHaveBeenCalledTimes(2);

    // The newest response lands first…
    await act(async () => {
      resolveSecond(modelsResponse(["gpt-4o"]));
    });
    expect(result?.fetchedModels).toEqual(["gpt-4o"]);

    // …then the stale response for the old provider must be ignored.
    await act(async () => {
      resolveFirst(modelsResponse(["gemini-stale"]));
    });
    expect(result?.fetchedModels).toEqual(["gpt-4o"]);
  });

  it("does not fetch without an API key or a saved key and exposes an empty list", async () => {
    // Arrange & Act
    await renderHarness(defaultOptions({ formApiKey: "" }));
    await settleDebounce();

    // Assert
    expect(modelsMock).not.toHaveBeenCalled();
    expect(result?.fetchedModels).toEqual([]);
  });

  it("fetches with the saved key and config id when editing an existing config", async () => {
    // Arrange
    modelsMock.mockResolvedValue(modelsResponse(["gemini-2.0-flash"]));

    // Act
    await renderHarness(
      defaultOptions({
        formApiKey: "",
        formModel: "gemini-2.0-flash",
        editingConfig,
      }),
    );
    await settleDebounce();

    // Assert
    expect(modelsMock).toHaveBeenCalledTimes(1);
    const call = modelsMock.mock.calls[0]?.[0] as { body?: Record<string, unknown> };
    expect(call?.body?.apiKey).toBeUndefined();
    expect(call?.body?.configId).toBe("cfg-1");
    expect(result?.fetchedModels).toEqual(["gemini-2.0-flash"]);
  });

  it("stops showing models as soon as the fetch inputs change (scope mismatch)", async () => {
    // Arrange
    modelsMock.mockResolvedValue(modelsResponse(["alpha", "beta"]));
    await renderHarness(defaultOptions());
    await settleDebounce();
    expect(result?.fetchedModels).toEqual(["alpha", "beta"]);

    // Act — provider change invalidates the fetched list immediately, before
    // the new (debounced) request resolves.
    modelsMock.mockResolvedValue(modelsResponse(["gpt-4o"]));
    await renderHarness(defaultOptions({ formProvider: "openai" }));

    // Assert
    expect(result?.fetchedModels).toEqual([]);

    await settleDebounce();
    expect(result?.fetchedModels).toEqual(["gpt-4o"]);
  });

  it("uses an injected console-specific fetcher instead of the tenant contract", async () => {
    // Arrange
    const injected: LlmModelFetcher = vi.fn().mockResolvedValue({
      success: true,
      models: ["custom-model"],
    });

    // Act
    await renderHarness(defaultOptions({ fetchModels: injected }));
    await settleDebounce();

    // Assert
    expect(modelsMock).not.toHaveBeenCalled();
    expect(injected).toHaveBeenCalledTimes(1);
    expect(result?.fetchedModels).toEqual(["custom-model"]);
  });

  it("clears the list when the API key is removed", async () => {
    // Arrange
    modelsMock.mockResolvedValue(modelsResponse(["alpha", "beta"]));
    await renderHarness(defaultOptions());
    await settleDebounce();
    expect(result?.fetchedModels).toEqual(["alpha", "beta"]);

    // Act — key removed and no saved key: the list must disappear.
    await renderHarness(defaultOptions({ formApiKey: "" }));

    // Assert
    expect(result?.fetchedModels).toEqual([]);
  });
});
