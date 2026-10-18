import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Badge } from "./Badge";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Badge component - Modern Web Guidance: precise-text-alignment", () => {
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

  it("renders with text-box trimming class for sub-pixel leading alignment", async () => {
    await act(async () => {
      root.render(<Badge>Active Status</Badge>);
    });

    const badge = container.querySelector("div");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("Active Status");
    expect(badge?.className).toContain("[text-box:trim-both_cap_alphabetic]");
  });

  it("renders with custom tone and pill styling", async () => {
    await act(async () => {
      root.render(
        <Badge tone="success" pill>
          Paid
        </Badge>,
      );
    });

    const badge = container.querySelector("div");
    expect(badge?.className).toContain("rounded-full");
    expect(badge?.className).toContain("text-success");
  });

  it("renders removable close button and handles removal click", async () => {
    const handleRemove = vi.fn();
    await act(async () => {
      root.render(
        <Badge onRemove={handleRemove} removeAriaLabel="Remove tag">
          Removable Tag
        </Badge>,
      );
    });

    const removeBtn = container.querySelector('button[aria-label="Remove tag"]') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();

    await act(async () => {
      removeBtn.click();
    });

    expect(handleRemove).toHaveBeenCalledTimes(1);
  });
});
