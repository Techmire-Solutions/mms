import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ overlayLayerCount: vi.fn(() => 0) }));

vi.mock("@/lib/overlayStack", () => ({
  overlayLayerCount: () => mocks.overlayLayerCount(),
}));

vi.mock("@/hooks/useModuleCreateHotkey", () => ({
  useModuleCreateHotkey: vi.fn(),
}));

import { useModuleWorkKeyboardShortcuts } from "./useModuleWorkKeyboardShortcuts";

describe("useModuleWorkKeyboardShortcuts", () => {
  let container: HTMLDivElement;
  let root: Root;
  const clearSelection = vi.fn();
  const clearFilters = vi.fn();
  const onCreate = vi.fn();

  function renderHook(): void {
    function TestComponent() {
      useModuleWorkKeyboardShortcuts({
        searchInputId: "students-work-search",
        selectedCount: 1,
        hasActiveFilters: true,
        clearSelection,
        clearFilters,
        onCreate,
      });
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  function pressEscape(): void {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    clearSelection.mockClear();
    clearFilters.mockClear();
    onCreate.mockClear();
    mocks.overlayLayerCount.mockReturnValue(0);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("clears the selection on Escape when no overlay is open", () => {
    renderHook();
    pressEscape();
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape while a dialog or drawer owns the keyboard", () => {
    // 2026-11-04 review (n3): the window listener also ran for the open drawer/form, so
    // pressing Escape to close it silently cleared the page selection/filters behind it.
    mocks.overlayLayerCount.mockReturnValue(1);
    renderHook();
    pressEscape();
    expect(clearSelection).not.toHaveBeenCalled();
    expect(clearFilters).not.toHaveBeenCalled();
  });
});
