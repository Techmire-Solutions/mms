import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import { BrandSaveCustomPresetModal } from "./BrandSaveCustomPresetModal";

const t = ((key: string) => key) as unknown as TranslationFunction;

describe("BrandSaveCustomPresetModal", () => {
  it("uses the canonical FormModal footer and required preset field", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <BrandSaveCustomPresetModal
          open
          onClose={onClose}
          primaryColor="#111111"
          secondaryColor="#222222"
          presetNameDraft="My preset"
          onPresetNameDraftChange={vi.fn()}
          onSave={onSave}
          t={t}
        />,
      );
    });

    expect(document.body.textContent).toContain("common.cancel");
    expect(document.body.textContent).toContain("common.save");
    expect(document.querySelector("#preset-name-input")).toBeInstanceOf(HTMLInputElement);

    const cancel = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "common.cancel",
    );
    await act(async () => cancel?.click());
    expect(onClose).toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });
});
