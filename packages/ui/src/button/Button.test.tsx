import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { CopyButton } from "./CopyButton";

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

  it("applies accessible muted hover classes for ghost and outline variants", async () => {
    await act(async () => {
      root.render(
        <div>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="outline">Outline Button</Button>
        </div>,
      );
    });
    const buttons = container.querySelectorAll("button");
    const ghost = buttons[0];
    const outline = buttons[1];

    expect(ghost.className).toContain("hover:bg-muted");
    expect(ghost.className).toContain("hover:text-foreground");
    expect(ghost.className).not.toContain("hover:text-accent-foreground");

    expect(outline.className).toContain("hover:bg-muted");
    expect(outline.className).toContain("hover:text-foreground");
    expect(outline.className).not.toContain("hover:text-accent-foreground");
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

  it("applies the tokenized radius, focus, pressed and disabled-state contract", async () => {
    await act(async () => {
      root.render(<Button>Save</Button>);
    });
    const button = container.querySelector("button") as HTMLButtonElement;

    expect(button.className).toContain("rounded-lg");
    expect(button.className).not.toContain("rounded-xl");
    expect(button.className).toContain("focus-visible:ring-2");
    expect(button.className).toContain("focus-visible:ring-ring");
    expect(button.className).toContain("focus-visible:ring-offset-2");
    expect(button.className).toContain("focus-visible:ring-offset-background");
    expect(button.className).toContain("active:scale-tap");
    expect(button.className).toContain("disabled:bg-primary");
    expect(button.className).toContain("disabled:cursor-not-allowed");
    expect(button.className).toContain("disabled:opacity-50");
    expect(button.className).toContain("transition");
  });

  it("exposes aria-disabled and suppresses hover styling when disabled", async () => {
    await act(async () => {
      root.render(<Button disabled>Save</Button>);
    });
    const button = container.querySelector("button") as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.className).toContain("disabled:bg-primary");
    // `aria-disabled:pointer-events-none` is slot-only; on a native button it would
    // suppress `cursor-not-allowed`.
    expect(button.className).not.toContain("aria-disabled:pointer-events-none");
    // The explicit disabled reset is what beats the (still-matching) :hover rule.
    expect(button.className).not.toMatch(/(?:^|\s)hover:bg-primary(?:\s|$)/);
  });

  it("announces loading, keeps the label in the DOM and preserves layout width", async () => {
    await act(async () => {
      root.render(
        <Button isLoading loadingText="Processing...">
          Submit
        </Button>,
      );
    });
    const button = container.querySelector("button") as HTMLButtonElement;
    const content = button.querySelector('[data-slot="button-content"]') as HTMLElement;
    const overlay = button.querySelector('[data-slot="button-loading"]') as HTMLElement;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(content).toBeTruthy();
    expect(content.className).toContain("opacity-0");
    expect(content.textContent).toContain("Submit");
    expect(overlay.textContent).toContain("Processing...");
    expect(overlay.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders a spinner without a loading label while keeping the original label", async () => {
    await act(async () => {
      root.render(<Button isLoading>Submit</Button>);
    });
    const button = container.querySelector("button") as HTMLButtonElement;
    const content = button.querySelector('[data-slot="button-content"]') as HTMLElement;
    const overlay = button.querySelector('[data-slot="button-loading"]') as HTMLElement;

    expect(content.className).toContain("opacity-0");
    expect(content.textContent).toContain("Submit");
    expect(overlay.textContent).toBe("");
    expect(overlay.querySelector(".animate-spin")).toBeTruthy();
  });

  it("blocks asChild navigation and exposes disabled semantics", async () => {
    const handleClick = vi.fn();
    await act(async () => {
      root.render(
        <Button asChild disabled onClick={handleClick}>
          <a href="#target">Open</a>
        </Button>,
      );
    });
    const link = container.querySelector("a") as HTMLAnchorElement;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.className).toContain("aria-disabled:pointer-events-none");
    expect(link.hasAttribute("disabled")).toBe(false);
    expect(handleClick).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("allows asChild clicks when enabled and exposes aria-busy while loading", async () => {
    const handleClick = vi.fn();
    await act(async () => {
      root.render(
        <Button asChild onClick={handleClick}>
          <a href="#target">Open</a>
        </Button>,
      );
    });
    const link = container.querySelector("a") as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(handleClick).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(
        <Button asChild isLoading>
          <a href="#target">Open</a>
        </Button>,
      );
    });
    const busyLink = container.querySelector("a") as HTMLAnchorElement;
    expect(busyLink.getAttribute("aria-busy")).toBe("true");
    expect(busyLink.getAttribute("aria-disabled")).toBe("true");
  });

  it("renders CopyButton icon-only through the outline variant", async () => {
    await act(async () => {
      root.render(<CopyButton text="copy me" />);
    });
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.className).toContain("border-input");
    expect(button.className).not.toContain("bg-primary");
    expect(button.getAttribute("aria-label")).toBe("Copy to clipboard");
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
