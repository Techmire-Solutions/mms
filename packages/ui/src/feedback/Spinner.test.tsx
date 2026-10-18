import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Spinner } from "./Spinner";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Spinner component - Modern Web Guidance: spinner", () => {
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

  it("renders with role='status' and indeterminate <progress> element", async () => {
    await act(async () => {
      root.render(<Spinner label="Saving changes..." />);
    });

    const statusWrapper = container.querySelector('[role="status"]');
    expect(statusWrapper).not.toBeNull();

    const progressEl = container.querySelector("progress");
    expect(progressEl).not.toBeNull();
    expect(progressEl?.getAttribute("aria-label")).toBe("Saving changes...");
    expect(progressEl?.hasAttribute("data-loading-spinner")).toBe(true);

    const srOnly = container.querySelector(".sr-only");
    expect(srOnly).not.toBeNull();
    expect(srOnly?.textContent).toBe("Saving changes...");
  });

  it("renders visible label when showLabel is true", async () => {
    await act(async () => {
      root.render(<Spinner label="Processing..." showLabel />);
    });

    const srOnly = container.querySelector(".sr-only");
    expect(srOnly).toBeNull();

    const visibleLabel = container.querySelector("span:not(.sr-only)");
    expect(visibleLabel).not.toBeNull();
    expect(visibleLabel?.textContent).toBe("Processing...");
  });

  it("applies sizing and variant classes correctly", async () => {
    await act(async () => {
      root.render(<Spinner size="lg" variant="muted" />);
    });

    const progressEl = container.querySelector("progress");
    expect(progressEl?.className).toContain("size-8");
    expect(progressEl?.className).toContain("text-muted-foreground");
  });
});
