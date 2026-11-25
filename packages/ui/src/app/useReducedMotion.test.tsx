import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./useReducedMotion";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: ((ev: MediaQueryListEvent) => void) | null;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  addListener: (listener: (ev: MediaQueryListEvent) => void) => void;
  removeListener: (listener: (ev: MediaQueryListEvent) => void) => void;
  dispatchEvent: (event: Event) => boolean;
}

describe("useReducedMotion", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    originalMatchMedia = window.matchMedia;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.matchMedia = originalMatchMedia;
  });

  it("returns true on the very first synchronous render when reduced motion is preferred", async () => {
    const listeners = new Set<EventListener>();
    const mediaList: MockMediaQueryList = {
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: (_type, listener) => {
        if (typeof listener === "function") listeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        if (typeof listener === "function") listeners.delete(listener);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => true,
    };

    window.matchMedia = vi.fn().mockReturnValue(mediaList as unknown as MediaQueryList);

    const renderValues: boolean[] = [];
    function Probe(): React.JSX.Element {
      const reduced = useReducedMotion();
      renderValues.push(reduced);
      return <div data-reduced={String(reduced)} />;
    }

    await act(async () => {
      root.render(<Probe />);
    });

    expect(renderValues[0]).toBe(true);
    expect(container.firstElementChild?.getAttribute("data-reduced")).toBe("true");

    mediaList.matches = false;
    await act(async () => {
      for (const listener of listeners) {
        listener(new Event("change"));
      }
    });

    expect(container.firstElementChild?.getAttribute("data-reduced")).toBe("false");
  });
});
