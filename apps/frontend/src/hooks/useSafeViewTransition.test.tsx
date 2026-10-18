import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSafeViewTransition } from "./useSafeViewTransition";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useSafeViewTransition", () => {
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
    vi.restoreAllMocks();
  });

  function renderHookHelper(): { transition: (fn: () => void) => void } {
    let captured: (fn: () => void) => void = () => {};
    function TestComponent() {
      captured = useSafeViewTransition();
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
    return { transition: captured };
  }

  it("executes updateFn directly when startViewTransition is unsupported", () => {
    const { transition } = renderHookHelper();
    const updateFn = vi.fn();

    transition(updateFn);
    expect(updateFn).toHaveBeenCalled();
  });

  it("calls startViewTransition when available and reduced-motion is not requested", () => {
    const startViewTransitionSpy = vi.fn((fn: () => void) => fn());
    const originalSVT = (document as unknown as { startViewTransition?: unknown })
      .startViewTransition;
    (document as unknown as { startViewTransition?: unknown }).startViewTransition =
      startViewTransitionSpy;

    const { transition } = renderHookHelper();
    const updateFn = vi.fn();

    transition(updateFn);

    expect(startViewTransitionSpy).toHaveBeenCalledWith(updateFn);
    expect(updateFn).toHaveBeenCalled();

    (document as unknown as { startViewTransition?: unknown }).startViewTransition = originalSVT;
  });

  it("bypasses startViewTransition when prefers-reduced-motion is active", () => {
    const startViewTransitionSpy = vi.fn((fn: () => void) => fn());
    const originalSVT = (document as unknown as { startViewTransition?: unknown })
      .startViewTransition;
    (document as unknown as { startViewTransition?: unknown }).startViewTransition =
      startViewTransitionSpy;

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { transition } = renderHookHelper();
    const updateFn = vi.fn();

    transition(updateFn);

    expect(startViewTransitionSpy).not.toHaveBeenCalled();
    expect(updateFn).toHaveBeenCalled();

    (document as unknown as { startViewTransition?: unknown }).startViewTransition = originalSVT;
    window.matchMedia = originalMatchMedia;
  });
});
