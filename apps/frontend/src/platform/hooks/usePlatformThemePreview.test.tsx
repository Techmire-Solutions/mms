import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDocumentTheme } from "@/lib/brandingThemeCore";
import { applyApexPlatformTheme } from "@/platform/lib/brandingEntryTheme";
import { MMS_PLATFORM_BRANDING } from "@/platform/lib/themeScope";
import { usePlatformThemePreview } from "./usePlatformThemePreview";

vi.mock("@/lib/brandingThemeCore", () => ({ applyDocumentTheme: vi.fn() }));
vi.mock("@/platform/lib/brandingEntryTheme", () => ({ applyApexPlatformTheme: vi.fn() }));

function Preview() {
  const { setSelectedMode } = usePlatformThemePreview();
  return <button onClick={() => setSelectedMode("dark")}>Dark</button>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("platform appearance preview", () => {
  it("uses platform branding, follows system changes, and restores defaults on close", async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => root.render(<Preview />));
      expect(applyDocumentTheme).toHaveBeenLastCalledWith(MMS_PLATFORM_BRANDING, "system", "en");
      expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
      await act(async () => container.querySelector("button")?.click());
      expect(applyDocumentTheme).toHaveBeenLastCalledWith(MMS_PLATFORM_BRANDING, "dark", "en");
      expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    } finally {
      await act(async () => root.unmount());
    }
    expect(applyApexPlatformTheme).toHaveBeenCalled();
  });
});
