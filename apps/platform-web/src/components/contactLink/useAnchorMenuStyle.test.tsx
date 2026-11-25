import React, { act, type CSSProperties, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAnchorMenuStyle } from "./useAnchorMenuStyle";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useAnchorMenuStyle hook", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockElement: HTMLElement;
  let anchorRef: RefObject<HTMLElement | null>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    mockElement = document.createElement("div");
    vi.spyOn(mockElement, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 140,
      left: 50,
      right: 250,
      width: 200,
      height: 40,
      x: 50,
      y: 100,
      toJSON: () => {},
    });
    anchorRef = { current: mockElement };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function renderHookHelper(open: boolean): { getStyle: () => CSSProperties } {
    let capturedStyle: CSSProperties = {};
    function TestComponent() {
      capturedStyle = useAnchorMenuStyle(open, anchorRef);
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
    return { getStyle: () => capturedStyle };
  }

  it("returns empty style when open=false", () => {
    const { getStyle } = renderHookHelper(false);
    expect(getStyle()).toEqual({});
  });

  it("calculates positioning style when open=true", () => {
    const { getStyle } = renderHookHelper(true);
    const style = getStyle();
    expect(style.position).toBe("fixed");
    expect(style.left).toBe(50);
    expect(style.width).toBe(200);
    expect(style.top).toBe(146); // 140 + 6px gap
  });

  it("attaches scroll and scrollend event listeners when open=true and cleans them up on unmount", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    renderHookHelper(true);

    expect(addEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function), true);

    act(() => {
      root.unmount();
    });

    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function), true);
  });

  it("handles scroll event with requestAnimationFrame without throwing", () => {
    const { getStyle } = renderHookHelper(true);
    expect(getStyle().top).toBe(146);

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(getStyle().position).toBe("fixed");
  });
});
