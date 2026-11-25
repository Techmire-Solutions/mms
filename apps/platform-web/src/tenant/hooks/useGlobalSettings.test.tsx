import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useGlobalSettings } from "./useGlobalSettings";
import type { GlobalSettings } from "@mms/contracts";

const mocks = vi.hoisted(() => ({
  getScopedGlobalSettings: vi.fn<() => GlobalSettings>(),
}));

vi.mock("@mms/fe-core/lib/settingsPreviewStore", () => ({
  getScopedGlobalSettings: mocks.getScopedGlobalSettings,
}));
vi.mock("@mms/fe-core/lib/settingsPreview", () => ({
  SETTINGS_PREVIEW_EVENT: "mms-settings-preview",
}));

function renderHook(): {
  current: () => GlobalSettings;
  unmount: () => void;
} {
  let settings!: GlobalSettings;
  function Harness() {
    settings = useGlobalSettings();
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(<Harness />);
  });
  return {
    current: () => settings,
    unmount: () => act(() => root.unmount()),
  };
}

describe("useGlobalSettings", () => {
  beforeEach(() => {
    mocks.getScopedGlobalSettings.mockReset();
    mocks.getScopedGlobalSettings.mockReturnValue({ language: "en" } as GlobalSettings);
  });

  it("returns the scoped settings snapshot", () => {
    const { current, unmount } = renderHook();
    expect(current().language).toBe("en");
    unmount();
  });

  it("re-renders with the new snapshot when the store dispatches an update", () => {
    const { current, unmount } = renderHook();

    mocks.getScopedGlobalSettings.mockReturnValue({ language: "ar" } as GlobalSettings);
    act(() => {
      window.dispatchEvent(new CustomEvent("mms-settings-preview"));
    });

    expect(current().language).toBe("ar");
    unmount();
  });

  it("keeps the snapshot identity stable when the underlying payload is unchanged", () => {
    const { current, unmount } = renderHook();
    const first = current();

    act(() => {
      window.dispatchEvent(new CustomEvent("mms-settings-preview"));
    });

    // Same serialized payload -> same object, so downstream memoization holds.
    expect(current()).toBe(first);
    unmount();
  });
});
