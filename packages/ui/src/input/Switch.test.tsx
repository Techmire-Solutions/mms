import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Switch } from "./Switch";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Switch component - Modern Web Guidance: switch", () => {
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

  it("renders with role='switch', data-switch, and unchecked state by default", async () => {
    await act(async () => {
      root.render(<Switch aria-label="Enable notifications" />);
    });

    const switchBtn = container.querySelector('[role="switch"]');
    expect(switchBtn).not.toBeNull();
    expect(switchBtn?.getAttribute("aria-checked")).toBe("false");
    expect(switchBtn?.hasAttribute("data-switch")).toBe(true);
    expect(switchBtn?.getAttribute("aria-label")).toBe("Enable notifications");
  });

  it("handles checked state and change callbacks", async () => {
    const handleCheckedChange = vi.fn();
    await act(async () => {
      root.render(
        <Switch
          checked={true}
          onCheckedChange={handleCheckedChange}
          aria-label="Dark mode"
        />,
      );
    });

    const switchBtn = container.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(switchBtn?.getAttribute("aria-checked")).toBe("true");

    await act(async () => {
      switchBtn.click();
    });

    expect(handleCheckedChange).toHaveBeenCalledWith(false);
  });
});
