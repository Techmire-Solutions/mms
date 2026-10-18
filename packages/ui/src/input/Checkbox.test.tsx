import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Checkbox } from "./Checkbox";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Checkbox component", () => {
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

  it("renders unchecked checkbox with 44px hit-target padding class and unchecked state", async () => {
    await act(async () => {
      root.render(<Checkbox id="terms" checked={false} />);
    });

    const button = container.querySelector('button[role="checkbox"]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-state")).toBe("unchecked");
    expect(button?.getAttribute("aria-checked")).toBe("false");
    expect(button?.className).toContain("after:h-11");
    expect(button?.className).toContain("after:w-11");
  });

  it("renders checked state with Check icon and checked data-state", async () => {
    await act(async () => {
      root.render(<Checkbox id="terms" checked={true} />);
    });

    const button = container.querySelector('button[role="checkbox"]');
    expect(button?.getAttribute("data-state")).toBe("checked");
    expect(button?.getAttribute("aria-checked")).toBe("true");

    const svg = button?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains("lucide-check")).toBe(true);
  });

  it("renders indeterminate state with Minus icon and indeterminate data-state", async () => {
    await act(async () => {
      root.render(<Checkbox id="select-all" checked="indeterminate" />);
    });

    const button = container.querySelector('button[role="checkbox"]');
    expect(button?.getAttribute("data-state")).toBe("indeterminate");
    expect(button?.getAttribute("aria-checked")).toBe("mixed");

    const svg = button?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains("lucide-minus")).toBe(true);
  });

  it("applies error styling when error is true", async () => {
    await act(async () => {
      root.render(<Checkbox id="error-check" error={true} />);
    });

    const button = container.querySelector('button[role="checkbox"]');
    expect(button?.className).toContain("border-destructive");
  });

  it("applies disabled styling and attribute when disabled", async () => {
    await act(async () => {
      root.render(<Checkbox id="disabled-check" disabled />);
    });

    const button = container.querySelector('button[role="checkbox"]');
    expect(button?.hasAttribute("disabled")).toBe(true);
    expect(button?.className).toContain("disabled:cursor-not-allowed");
  });
});
