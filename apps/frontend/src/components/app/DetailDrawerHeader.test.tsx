import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DetailDrawerHeader } from "./DetailDrawerHeader";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DetailDrawerHeader", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders title, subtitle, badge, and triggers onClose", async () => {
    const handleClose = vi.fn();
    const handleDragStart = vi.fn();

    await act(async () => {
      root.render(
        <DetailDrawerHeader
          titleId="drawer-title"
          title="Student Details"
          subtitle="Grade 5 · Section A"
          badge={<span data-testid="test-badge">Active</span>}
          headerActions={<button type="button">Print</button>}
          onClose={handleClose}
          isDesktop={true}
          onPointerDragStart={handleDragStart}
        />,
      );
    });

    expect(container.textContent).toContain("Student Details");
    expect(container.textContent).toContain("Grade 5 · Section A");
    expect(container.textContent).toContain("Active");
    expect(container.textContent).toContain("Print");

    const closeButton =
      container.querySelector('button[aria-label="Close"]') ??
      container.querySelector("button[aria-label]");
    expect(closeButton).not.toBeNull();
    if (closeButton) {
      await act(async () => {
        closeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(handleClose).toHaveBeenCalledTimes(1);
    }
  });
});
