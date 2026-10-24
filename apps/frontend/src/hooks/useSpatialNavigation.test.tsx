import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSpatialNavigation } from "./useSpatialNavigation";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function MockGrid({
  onFocusItem,
  axis,
}: {
  onFocusItem?: (element: HTMLElement, index: number) => void;
  axis?: "both" | "horizontal" | "vertical";
}) {
  const { containerRef, onKeyDown } = useSpatialNavigation<HTMLDivElement>({
    onFocusItem,
    axis,
  });

  return (
    <div ref={containerRef} onKeyDown={onKeyDown} data-testid="container">
      <div data-spatial-item id="item-0">
        Item 0
      </div>
      <div data-spatial-item id="item-1">
        Item 1
      </div>
      <div data-spatial-item id="item-2">
        Item 2
      </div>
      <input type="text" data-testid="nested-input" />
    </div>
  );
}

function mockRect(
  el: HTMLElement,
  rect: { top: number; left: number; right: number; bottom: number },
) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  });
}

describe("useSpatialNavigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("initializes roving tabindex with first element active", async () => {
    await act(async () => {
      root.render(<MockGrid />);
    });

    const item0 = container.querySelector("#item-0") as HTMLElement;
    const item1 = container.querySelector("#item-1") as HTMLElement;
    const item2 = container.querySelector("#item-2") as HTMLElement;

    expect(item0.tabIndex).toBe(0);
    expect(item1.tabIndex).toBe(-1);
    expect(item2.tabIndex).toBe(-1);
  });

  it("navigates horizontally to the right item on ArrowRight", async () => {
    const onFocus = vi.fn();
    await act(async () => {
      root.render(<MockGrid onFocusItem={onFocus} />);
    });

    const item0 = container.querySelector("#item-0") as HTMLElement;
    const item1 = container.querySelector("#item-1") as HTMLElement;
    const item2 = container.querySelector("#item-2") as HTMLElement;
    const grid = container.querySelector('[data-testid="container"]') as HTMLElement;

    // item0 at (0,0)-(100,100), item1 at (120,0)-(220,100), item2 at (0,120)-(100,220)
    mockRect(item0, { top: 0, left: 0, right: 100, bottom: 100 });
    mockRect(item1, { top: 0, left: 120, right: 220, bottom: 100 });
    mockRect(item2, { top: 120, left: 0, right: 100, bottom: 220 });

    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      grid.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onFocus).toHaveBeenCalledWith(item1, 1);
    expect(item0.tabIndex).toBe(-1);
    expect(item1.tabIndex).toBe(0);
  });

  it("navigates vertically to the item below on ArrowDown", async () => {
    const onFocus = vi.fn();
    await act(async () => {
      root.render(<MockGrid onFocusItem={onFocus} />);
    });

    const item0 = container.querySelector("#item-0") as HTMLElement;
    const item1 = container.querySelector("#item-1") as HTMLElement;
    const item2 = container.querySelector("#item-2") as HTMLElement;
    const grid = container.querySelector('[data-testid="container"]') as HTMLElement;

    mockRect(item0, { top: 0, left: 0, right: 100, bottom: 100 });
    mockRect(item1, { top: 0, left: 120, right: 220, bottom: 100 });
    mockRect(item2, { top: 120, left: 0, right: 100, bottom: 220 });

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      grid.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onFocus).toHaveBeenCalledWith(item2, 2);
  });

  it("does not prevent default on boundary to preserve native browser scrolling", async () => {
    await act(async () => {
      root.render(<MockGrid />);
    });

    const item0 = container.querySelector("#item-0") as HTMLElement;
    const item1 = container.querySelector("#item-1") as HTMLElement;
    const item2 = container.querySelector("#item-2") as HTMLElement;
    const grid = container.querySelector('[data-testid="container"]') as HTMLElement;

    mockRect(item0, { top: 0, left: 0, right: 100, bottom: 100 });
    mockRect(item1, { top: 0, left: 120, right: 220, bottom: 100 });
    mockRect(item2, { top: 120, left: 0, right: 100, bottom: 220 });

    // When on item0 (leftmost), ArrowLeft has no candidate
    const event = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      grid.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores arrow keys when target is a nested input", async () => {
    await act(async () => {
      root.render(<MockGrid />);
    });

    const input = container.querySelector('[data-testid="nested-input"]') as HTMLInputElement;

    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      input.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });

  it("respects axis restriction", async () => {
    const onFocus = vi.fn();
    await act(async () => {
      root.render(<MockGrid axis="horizontal" onFocusItem={onFocus} />);
    });

    const item0 = container.querySelector("#item-0") as HTMLElement;
    const item2 = container.querySelector("#item-2") as HTMLElement;
    const grid = container.querySelector('[data-testid="container"]') as HTMLElement;

    mockRect(item0, { top: 0, left: 0, right: 100, bottom: 100 });
    mockRect(item2, { top: 120, left: 0, right: 100, bottom: 220 });

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      grid.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(onFocus).not.toHaveBeenCalled();
  });
});
