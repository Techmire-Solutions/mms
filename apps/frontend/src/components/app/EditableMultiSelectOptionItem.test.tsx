import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { EditableMultiSelectOptionItem } from "./EditableMultiSelectOptionItem";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockT: TranslationFunction = ((key: string, params?: Record<string, unknown>) => {
  if (params?.option) return `${key}:${params.option}`;
  return key;
}) as unknown as TranslationFunction;

describe("EditableMultiSelectOptionItem", () => {
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
  });

  it("handles mouse hover, click, and keyboard selection", async () => {
    const onHover = vi.fn();
    const onToggle = vi.fn();
    const onRemove = vi.fn();

    await act(async () => {
      root.render(
        <EditableMultiSelectOptionItem
          option="Developer"
          index={0}
          resolvedId="roles"
          isSelected={false}
          isHighlighted={false}
          canRemoveOptions={true}
          t={mockT}
          onHoverOption={onHover}
          onToggleOption={onToggle}
          onRemoveOption={onRemove}
        />,
      );
    });

    const item = container.querySelector('[role="option"]') as HTMLElement;
    expect(item).toBeTruthy();
    expect(item.getAttribute("aria-selected")).toBe("false");

    // Mouse enter / over
    await act(async () => {
      item.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(onHover).toHaveBeenCalledWith(0);

    // Click
    await act(async () => {
      item.click();
    });
    expect(onToggle).toHaveBeenCalledWith("Developer");

    // Keyboard Enter
    await act(async () => {
      item.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onToggle).toHaveBeenCalledTimes(2);

    // Keyboard Space
    await act(async () => {
      item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });
    expect(onToggle).toHaveBeenCalledTimes(3);

    // Remove button
    const removeBtn = container.querySelector("button") as HTMLButtonElement;
    expect(removeBtn).toBeTruthy();
    await act(async () => {
      removeBtn.click();
    });
    expect(onRemove).toHaveBeenCalledWith("Developer", expect.anything());
  });

  it("renders selected and highlighted styles properly", async () => {
    await act(async () => {
      root.render(
        <EditableMultiSelectOptionItem
          option="Admin"
          index={1}
          resolvedId="roles"
          isSelected={true}
          isHighlighted={true}
          canRemoveOptions={false}
          t={mockT}
          onToggleOption={vi.fn()}
          onRemoveOption={vi.fn()}
        />,
      );
    });

    const item = container.querySelector('[role="option"]') as HTMLElement;
    expect(item.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("button")).toBeNull();
  });
});
