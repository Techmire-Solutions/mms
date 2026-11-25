import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSettingsPaletteSection } from "./ThemeSettingsPaletteSection";

import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ThemeSettingsPaletteSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockT = ((key: string) => key) as unknown as TranslationFunction;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("returns null when extractedPalette is empty", async () => {
    await act(async () => {
      root.render(
        <ThemeSettingsPaletteSection
          t={mockT}
          extractedPalette={[]}
          onPrimaryChange={vi.fn()}
          onSecondaryChange={vi.fn()}
        />,
      );
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders extracted swatches and dispatches color changes", async () => {
    const onPrimaryChange = vi.fn();
    const onSecondaryChange = vi.fn();
    const onApplyBestPair = vi.fn();

    await act(async () => {
      root.render(
        <ThemeSettingsPaletteSection
          t={mockT}
          extractedPalette={["#10b981", "#3b82f6"]}
          bestPair={{ primary: "#10b981", secondary: "#3b82f6" }}
          onApplyBestPair={onApplyBestPair}
          onPrimaryChange={onPrimaryChange}
          onSecondaryChange={onSecondaryChange}
        />,
      );
    });

    expect(container.textContent).toContain("#10b981");
    expect(container.textContent).toContain("#3b82f6");
    expect(container.textContent).toContain("theme.applyLogoPair");

    const applyPairBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("theme.applyLogoPair"),
    );
    expect(applyPairBtn).toBeDefined();

    await act(async () => {
      applyPairBtn?.click();
    });

    expect(onApplyBestPair).toHaveBeenCalled();

    const setPrimaryBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("theme.setAsPrimary"),
    );
    expect(setPrimaryBtn).toBeDefined();

    await act(async () => {
      setPrimaryBtn?.click();
    });

    expect(onPrimaryChange).toHaveBeenCalledWith("#10b981");
  });
});
