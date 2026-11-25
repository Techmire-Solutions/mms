import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSystemThemeListener } from "@mms/fe-core/hooks/useSystemThemeListener";

describe("useSystemThemeListener", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mirrors the current preference, notifies on changes, and cleans up", async () => {
    const changeListeners = new Set<(event: MediaQueryListEvent) => void>();
    const media = {
      matches: true,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn((type: string, callback: (event: MediaQueryListEvent) => void) => {
        if (type === "change") changeListeners.add(callback);
      }),
      removeEventListener: vi.fn((type: string, callback: (event: MediaQueryListEvent) => void) => {
        if (type === "change") changeListeners.delete(callback);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);

    let value: boolean | undefined;
    const onChange = vi.fn();
    function Probe(): null {
      value = useSystemThemeListener(onChange);
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<Probe />));
      expect(value).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true);

      media.matches = false;
      await act(async () => {
        for (const listener of changeListeners) {
          listener({ matches: false } as MediaQueryListEvent);
        }
      });
      expect(value).toBe(false);
      expect(onChange).toHaveBeenCalledWith(false);

      await act(async () => root.unmount());
      expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    } finally {
      container.remove();
    }
  });
});
