import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ToggleRow } from "./ToggleRow";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ToggleRow Component (@shared/ui)", () => {
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

  it("renders label, description, and switch input with role='switch'", async () => {
    await act(async () => {
      root.render(
        <ToggleRow
          id="email-toggle"
          label="Email Notifications"
          description="Send emails on updates"
          checked={false}
        />,
      );
    });

    expect(container.textContent).toContain("Email Notifications");
    expect(container.textContent).toContain("Send emails on updates");
    const switchEl = container.querySelector('[role="switch"]');
    expect(switchEl).not.toBeNull();
    expect(switchEl?.getAttribute("aria-checked")).toBe("false");
    expect(switchEl?.getAttribute("aria-describedby")).toBe("email-toggle-desc");
  });

  it("invokes onChange and onCheckedChange callbacks when toggled", async () => {
    const handleCheckedChange = vi.fn();
    const handleChange = vi.fn();

    await act(async () => {
      root.render(
        <ToggleRow
          label="SMS Alerts"
          checked={false}
          onCheckedChange={handleCheckedChange}
          onChange={handleChange}
        />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]') as HTMLElement;
    expect(switchEl).not.toBeNull();

    await act(async () => {
      switchEl.click();
    });

    expect(handleCheckedChange).toHaveBeenCalledWith(true);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("supports legacy value and onChange props", async () => {
    const handleChange = vi.fn();

    await act(async () => {
      root.render(<ToggleRow label="Dark Mode" value={true} onChange={handleChange} />);
    });

    const switchEl = container.querySelector('[role="switch"]');
    expect(switchEl?.getAttribute("aria-checked")).toBe("true");
  });

  it("renders card and bordered variants with appropriate styling classes", async () => {
    await act(async () => {
      root.render(<ToggleRow id="test-card" label="Card Mode" variant="card" checked={true} />);
    });

    expect(container.firstElementChild?.className).toContain("rounded-xl");
    expect(container.firstElementChild?.className).toContain("border-primary/20");

    await act(async () => {
      root.render(
        <ToggleRow id="test-bordered" label="Bordered Mode" variant="bordered" checked={false} />,
      );
    });

    expect(container.firstElementChild?.className).toContain("rounded-lg");
    expect(container.firstElementChild?.className).toContain("bg-card/50");
  });
});
