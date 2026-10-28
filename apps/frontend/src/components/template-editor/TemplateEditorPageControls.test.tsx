/**
 * @file TemplateEditorPageControls.test.tsx
 * @description Unit tests and coverage for TemplateEditorPageControls component.
 */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateEditorPageControls } from "./TemplateEditorPageControls";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockT = ((key: string) => {
  if (key === "templateEditor.portrait") return "Portrait";
  if (key === "templateEditor.landscape") return "Landscape";
  if (key === "templateEditor.pageSize") return "Page size";
  return key;
}) as TranslationFunction;

describe("TemplateEditorPageControls", () => {
  let container: HTMLDivElement;
  let root: Root;

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
    vi.restoreAllMocks();
  });

  it("renders portrait orientation and toggles to landscape on click", async () => {
    const handleOrientationChange = vi.fn();
    const handlePageSizeChange = vi.fn();

    await act(async () => {
      root.render(
        <TemplateEditorPageControls
          pageSize="A4"
          orientation="portrait"
          onPageSizeChange={handlePageSizeChange}
          onOrientationChange={handleOrientationChange}
          t={mockT}
        />,
      );
    });

    const orientationBtn = container.querySelector('button[title="Portrait"]');
    expect(orientationBtn).not.toBeNull();
    expect(orientationBtn?.getAttribute("aria-label")).toBe("Portrait");
    expect(orientationBtn?.textContent).toContain("Portrait");

    await act(async () => {
      orientationBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handleOrientationChange).toHaveBeenCalledWith("landscape");
  });

  it("renders landscape orientation and toggles to portrait on click", async () => {
    const handleOrientationChange = vi.fn();
    const handlePageSizeChange = vi.fn();

    await act(async () => {
      root.render(
        <TemplateEditorPageControls
          pageSize="A4"
          orientation="landscape"
          onPageSizeChange={handlePageSizeChange}
          onOrientationChange={handleOrientationChange}
          t={mockT}
        />,
      );
    });

    const orientationBtn = container.querySelector('button[title="Landscape"]');
    expect(orientationBtn).not.toBeNull();
    expect(orientationBtn?.getAttribute("aria-label")).toBe("Landscape");
    expect(orientationBtn?.textContent).toContain("Landscape");

    await act(async () => {
      orientationBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handleOrientationChange).toHaveBeenCalledWith("portrait");
  });

  it("triggers onPageSizeChange when page size changes", async () => {
    const handleOrientationChange = vi.fn();
    const handlePageSizeChange = vi.fn();

    await act(async () => {
      root.render(
        <TemplateEditorPageControls
          pageSize="A4"
          orientation="portrait"
          onPageSizeChange={handlePageSizeChange}
          onOrientationChange={handleOrientationChange}
          t={mockT}
        />,
      );
    });

    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    if (select) {
      await act(async () => {
        select.value = "Letter";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(handlePageSizeChange).toHaveBeenCalledWith("Letter");
    }
  });
});
