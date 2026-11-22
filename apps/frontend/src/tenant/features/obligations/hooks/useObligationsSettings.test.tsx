import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  OBLIGATIONS_SETTINGS_CHANGED_EVENT,
  saveObligationsSettings,
  useObligationsSettings,
  type UseObligationsSettingsReturn,
} from "./useObligationsSettings";
import type { ObligationsSettings } from "@mms/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mutationMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
}));

const setupApiMock = vi.hoisted(() => ({
  getObligationsSettingsMemoryFallback: vi.fn(() => ({ receiptPrefix: "FALLBACK" })),
  setObligationsPreferencesMemory: vi.fn(),
  saveObligationsPreferencesAsync: vi.fn().mockResolvedValue({ receiptPrefix: "OBL" }),
}));

vi.mock("./useObligationsSetupConfig", () => ({
  useComposedObligationsSettings: () => ({ receiptPrefix: "TEST-OBL" }),
  useObligationsPreferencesMutation: () => mutationMock,
}));

vi.mock("./obligationsSetupConfigApi", () => setupApiMock);

const NEXT_SETTINGS = { receiptPrefix: "NEXT" } as ObligationsSettings;

function renderSettingsHook() {
  let result!: UseObligationsSettingsReturn;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Probe() {
    result = useObligationsSettings();
    return null;
  }

  act(() => {
    root.render(<Probe />);
  });

  return {
    getResult: () => result,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useObligationsSettings", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutationMock.mutateAsync.mockResolvedValue(undefined);
    dispatchSpy = vi.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it("updateSettings performs exactly one server write through the mutation", () => {
    const { getResult, cleanup } = renderSettingsHook();

    act(() => {
      getResult().updateSettings(NEXT_SETTINGS);
    });

    expect(mutationMock.mutate).toHaveBeenCalledTimes(1);
    expect(setupApiMock.saveObligationsPreferencesAsync).not.toHaveBeenCalled();
    expect(setupApiMock.setObligationsPreferencesMemory).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect((dispatchSpy.mock.calls[0][0] as CustomEvent).type).toBe(
      OBLIGATIONS_SETTINGS_CHANGED_EVENT,
    );
    cleanup();
  });

  it("updateSettingsAsync awaits one server write and publishes locally", async () => {
    const { getResult, cleanup } = renderSettingsHook();

    await act(async () => {
      await getResult().updateSettingsAsync(NEXT_SETTINGS);
    });

    expect(mutationMock.mutateAsync).toHaveBeenCalledTimes(1);
    expect(setupApiMock.saveObligationsPreferencesAsync).not.toHaveBeenCalled();
    expect(setupApiMock.setObligationsPreferencesMemory).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("resetSettings publishes defaults through a single mutation write", () => {
    const { getResult, cleanup } = renderSettingsHook();

    act(() => {
      getResult().resetSettings();
    });

    expect(mutationMock.mutate).toHaveBeenCalledTimes(1);
    expect(setupApiMock.saveObligationsPreferencesAsync).not.toHaveBeenCalled();
    cleanup();
  });

  it("standalone saveObligationsSettings keeps its own fire-and-forget write contract", () => {
    saveObligationsSettings(NEXT_SETTINGS);

    expect(setupApiMock.saveObligationsPreferencesAsync).toHaveBeenCalledTimes(1);
    expect(setupApiMock.setObligationsPreferencesMemory).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect((dispatchSpy.mock.calls[0][0] as CustomEvent).type).toBe(
      OBLIGATIONS_SETTINGS_CHANGED_EVENT,
    );
  });
});
