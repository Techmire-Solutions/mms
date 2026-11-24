import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDocumentTheme } from "@/lib/brandingThemeCore";
import { applyApexPlatformTheme } from "@/lib/branding/apexPlatformTheme";
import {
  getPlatformBrandingAsBrandingSettings,
  setPlatformBrandingState,
} from "@/lib/branding/platformBrandingStore";
import { DEFAULT_PLATFORM_BRANDING } from "@mms/shared";
import { usePlatformThemePreview } from "@/platform/features/settings/hooks/usePlatformThemePreview";

vi.mock("@/lib/brandingThemeCore", () => ({ applyDocumentTheme: vi.fn() }));
vi.mock("@/lib/branding/apexPlatformTheme", () => ({ applyApexPlatformTheme: vi.fn() }));

function Preview() {
  const { selectedMode, setSelectedMode } = usePlatformThemePreview();
  return (
    <>
      <button onClick={() => setSelectedMode("dark")}>Dark</button>
      <button onClick={() => setSelectedMode("system")}>System</button>
      <span>{selectedMode}</span>
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("platform appearance preview", () => {
  it("uses platform branding, follows system changes, and restores defaults on close", async () => {
    setPlatformBrandingState({
      branding: {
        ...DEFAULT_PLATFORM_BRANDING,
        productName: "MMS",
        logoUrl: "/platform-logo.webp",
      },
      themeMode: "system",
      timezone: "UTC",
      dateFormat: "DD/MM/YYYY",
    });
    const expectedBranding = getPlatformBrandingAsBrandingSettings();
    // Arrange — a matchMedia double whose `matches` the test can flip.
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const mediaQueryList = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    vi.spyOn(window, "matchMedia").mockReturnValue(mediaQueryList);

    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => root.render(<Preview />));

      // Assert — initial render applies platform branding in the stored mode
      // and subscribes to the OS preference via the shared media-query hook.
      expect(applyDocumentTheme).toHaveBeenLastCalledWith(expectedBranding, "system", "en");
      expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
      const mediaHandler = addEventListener.mock.calls[0]?.[1] as () => void;

      // Act — an OS preference change re-applies the theme while "system".
      mediaQueryList.matches = true;
      act(() => {
        mediaHandler();
      });
      expect(applyDocumentTheme).toHaveBeenLastCalledWith(expectedBranding, "system", "en");

      // Act — an explicit mode applies immediately and the media subscription
      // stays live (it must, so returning to "system" keeps tracking the OS).
      await act(async () => container.querySelector("button")?.click());
      expect(applyDocumentTheme).toHaveBeenLastCalledWith(expectedBranding, "dark", "en");
      expect(removeEventListener).not.toHaveBeenCalled();

      // Act — return to "system"; the still-live subscription re-applies again.
      await act(async () => container.querySelectorAll("button")[1]?.click());
      expect(applyDocumentTheme).toHaveBeenLastCalledWith(expectedBranding, "system", "en");
      mediaQueryList.matches = false;
      act(() => {
        mediaHandler();
      });
      expect(applyDocumentTheme).toHaveBeenLastCalledWith(expectedBranding, "system", "en");
    } finally {
      await act(async () => root.unmount());
    }

    // Assert — closing the preview restores the apex theme and unsubscribes.
    expect(applyApexPlatformTheme).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
