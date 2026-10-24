import { describe, it, expect, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { usePlatformDensity, type PlatformDensityConfig } from "./usePlatformDensity";

function renderDensityHook() {
  let hookResult!: PlatformDensityConfig;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = usePlatformDensity();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    getResult: () => hookResult,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("usePlatformDensity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to standard density when no preference stored", () => {
    const { getResult, cleanup } = renderDensityHook();
    expect(getResult().density).toBe("standard");
    expect(getResult().rowHeight).toBe(48);
    expect(getResult().cellPaddingClass).toContain("px-4 py-2.5");
    cleanup();
  });

  it("initializes from localStorage when valid density is stored", () => {
    localStorage.setItem("mms_platform_density", "compact");
    const { getResult, cleanup } = renderDensityHook();
    expect(getResult().density).toBe("compact");
    expect(getResult().rowHeight).toBe(38);
    cleanup();
  });

  it("falls back to standard when unrecognized value stored", () => {
    localStorage.setItem("mms_platform_density", "extra-wide");
    const { getResult, cleanup } = renderDensityHook();
    expect(getResult().density).toBe("standard");
    expect(getResult().rowHeight).toBe(48);
    cleanup();
  });

  it("updates density and persists to localStorage on setDensity", () => {
    const { getResult, cleanup } = renderDensityHook();
    expect(getResult().density).toBe("standard");

    act(() => {
      getResult().setDensity("comfortable");
    });

    expect(getResult().density).toBe("comfortable");
    expect(getResult().rowHeight).toBe(64);
    expect(localStorage.getItem("mms_platform_density")).toBe("comfortable");
    cleanup();
  });
});
