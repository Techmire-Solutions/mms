import { describe, it, expect, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useWorkTableDensity, type WorkTableDensityConfig } from "@mms/fe-core/hooks";

function renderDensityHook() {
  let hookResult!: WorkTableDensityConfig;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = useWorkTableDensity();
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

describe("useWorkTableDensity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to standard (px-4 py-3) when no preference stored", () => {
    const { getResult, cleanup } = renderDensityHook();
    expect(getResult().density).toBe("standard");
    expect(getResult().cellPaddingClass).toContain("px-4 py-3");
    cleanup();
  });

  it("initializes from localStorage when a valid density is stored", () => {
    localStorage.setItem("mms_work_table_density", "compact");
    const { getResult, cleanup } = renderDensityHook();
    expect(getResult().density).toBe("compact");
    expect(getResult().cellPaddingClass).toContain("px-3 py-2");
    cleanup();
  });

  it("falls back to standard for an unrecognized stored value", () => {
    localStorage.setItem("mms_work_table_density", "ultra");
    const { getResult, cleanup } = renderDensityHook();
    expect(getResult().density).toBe("standard");
    cleanup();
  });

  it("updates and persists density on setDensity", () => {
    const { getResult, cleanup } = renderDensityHook();
    expect(getResult().density).toBe("standard");

    act(() => {
      getResult().setDensity("comfortable");
    });

    expect(getResult().density).toBe("comfortable");
    expect(getResult().cellPaddingClass).toContain("px-4 py-4");
    expect(localStorage.getItem("mms_work_table_density")).toBe("comfortable");
    cleanup();
  });
});
