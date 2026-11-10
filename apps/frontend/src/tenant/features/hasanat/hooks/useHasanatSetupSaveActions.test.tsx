import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { HasanatSettings } from "@mms/shared";
import { useHasanatSetupSaveActions } from "./useHasanatSetupSaveActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => `[${key}]` }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const BASE: HasanatSettings = {
  pointsPerUnit: 10,
  autoApprovePayouts: false,
  defaultViewLayout: "list",
  awardScope: "tenant",
};

function renderHook(draft: HasanatSettings) {
  let result!: ReturnType<typeof useHasanatSetupSaveActions>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const setSaved = vi.fn();
  const saveSettingsAsync = vi.fn(async () => undefined);

  function Probe() {
    result = useHasanatSetupSaveActions({
      settings: BASE,
      settingsDraft: draft,
      setSaved,
      saveSettingsAsync,
    });
    return null;
  }

  act(() => {
    root.render(<Probe />);
  });

  return {
    getResult: () => result,
    setSaved,
    saveSettingsAsync,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useHasanatSetupSaveActions", () => {
  it("treats an award-scope change as a dirty draft", () => {
    // Regression: awardScope was missing from the dirty-key list, so its control saved nothing.
    const harness = renderHook({ ...BASE, awardScope: "assigned_classes" });
    expect(harness.getResult().isPrefsDirty).toBe(true);
    harness.cleanup();
  });

  it("stays clean when nothing changed", () => {
    const harness = renderHook({ ...BASE });
    expect(harness.getResult().isPrefsDirty).toBe(false);
    harness.cleanup();
  });

  it("saves a dirty draft through the settings mutation", async () => {
    const harness = renderHook({ ...BASE, awardScope: "assigned_classes" });
    await act(async () => {
      await harness.getResult().handleSave();
    });
    expect(harness.saveSettingsAsync).toHaveBeenCalledOnce();
    expect(harness.setSaved).toHaveBeenCalledWith(true);
    harness.cleanup();
  });

  it("ignores a save request when the draft is clean", async () => {
    const harness = renderHook({ ...BASE });
    await act(async () => {
      await harness.getResult().handleSave();
    });
    expect(harness.saveSettingsAsync).not.toHaveBeenCalled();
    harness.cleanup();
  });
});
