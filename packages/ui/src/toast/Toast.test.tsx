import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Toast } from "./Toast";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Toast component - Modern Web Guidance: persistent-toast-notifications", () => {
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

  it("renders with role='status', title, and description", async () => {
    await act(async () => {
      root.render(
        <Toast
          title="Backup Created"
          description="Your workspace backup completed successfully."
          variant="success"
        />,
      );
    });

    const toast = container.querySelector('[role="status"]');
    expect(toast).not.toBeNull();
    expect(toast?.getAttribute("aria-live")).toBe("polite");
    expect(toast?.textContent).toContain("Backup Created");
    expect(toast?.textContent).toContain("Your workspace backup completed successfully.");
    expect(toast?.className).toContain("border-success/30");
  });

  it("supports popover='manual' for Top Layer promotion and close button target action", async () => {
    const handleClose = vi.fn();
    await act(async () => {
      root.render(
        <Toast
          title="Notification"
          popover="manual"
          onClose={handleClose}
        />,
      );
    });

    const toast = container.querySelector('[role="status"]');
    expect(toast?.getAttribute("popover")).toBe("manual");

    const closeBtn = container.querySelector('button[aria-label="Close"]');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.getAttribute("popovertargetaction")).toBe("hide");

    (closeBtn as HTMLButtonElement).click();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
