import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Button } from "./Button";
import { Badge } from "./Badge";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Button component", () => {
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

  it("renders with default props", async () => {
    await act(async () => {
      root.render(<Button>Click me</Button>);
    });
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.className).toContain("bg-primary");
    expect(button.textContent).toContain("Click me");
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    await act(async () => {
      root.render(<Button onClick={handleClick}>Submit</Button>);
    });
    const button = container.querySelector("button") as HTMLButtonElement;
    button.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("disables button and shows spinner when isLoading is true", async () => {
    await act(async () => {
      root.render(
        <Button isLoading loadingText="Processing...">
          Submit
        </Button>,
      );
    });
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(container.textContent).toContain("Processing...");
  });

  it("keeps caps labels trackable in LTR and untracked in RTL", async () => {
    // 2026-10-31 review: letter-spacing on Arabic/Urdu caps labels breaks joining.
    await act(async () => {
      root.render(<Button size="caps">Print summary</Button>);
    });
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.className).toContain("tracking-wider");
    expect(button.className).toContain("rtl:tracking-normal");
  });

  it("renders badge variants correctly", async () => {
    await act(async () => {
      root.render(<Badge variant="destructive">Failed</Badge>);
    });
    const badge = container.querySelector("[class*='bg-destructive']") as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("Failed");
  });
});
