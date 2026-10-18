import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleColumnCustomizerList } from "./ModuleColumnCustomizerList";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type { ModuleColumnCustomizerLabels } from "./moduleColumnCustomizerTypes";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockLabels: ModuleColumnCustomizerLabels = {
  trigger: "Customize Columns",
  title: "Columns Layout",
  visibleAndOrder: "Visible & Order",
  hidden: "Hidden Columns",
  fixed: "Fixed",
  hideColumn: (label: string) => `Hide ${label} column`,
  showColumn: (label: string) => `Show ${label} column`,
};

const mockVisible: ModuleColumnRegistryEntry[] = [
  { key: "name", label: "Full Name", enabled: true, order: 0, fixed: true },
  { key: "phone", label: "Phone Number", enabled: true, order: 1 },
];

const mockHidden: ModuleColumnRegistryEntry[] = [
  { key: "email", label: "Email Address", enabled: false, order: 2 },
];

describe("ModuleColumnCustomizerList Component", () => {
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
    document.body.removeChild(container);
  });

  it("renders visible and hidden sections with correct headers and labels", () => {
    const html = renderToStaticMarkup(
      <ModuleColumnCustomizerList
        visibleColumns={mockVisible}
        hiddenColumns={mockHidden}
        dragging={null}
        dragOver={null}
        labels={mockLabels}
        toggle={vi.fn()}
        handleDragStart={vi.fn()}
        handleDragOver={vi.fn()}
        handleDrop={vi.fn()}
        clearDrag={vi.fn()}
      />,
    );

    expect(html).toContain("Visible &amp; Order");
    expect(html).toContain("Full Name");
    expect(html).toContain("Phone Number");
    expect(html).toContain("Fixed");
    expect(html).toContain("Hidden Columns");
    expect(html).toContain("Email Address");
    expect(html).toContain('aria-label="Hide Phone Number column"');
    expect(html).toContain('aria-label="Show Email Address column"');
  });

  it("handles toggle callbacks on visible eye button and hidden column button", async () => {
    const toggle = vi.fn();

    await act(async () => {
      root.render(
        <ModuleColumnCustomizerList
          visibleColumns={mockVisible}
          hiddenColumns={mockHidden}
          dragging={null}
          dragOver={null}
          labels={mockLabels}
          toggle={toggle}
          handleDragStart={vi.fn()}
          handleDragOver={vi.fn()}
          handleDrop={vi.fn()}
          clearDrag={vi.fn()}
        />,
      );
    });

    const hideButton = container.querySelector('button[aria-label="Hide Phone Number column"]');
    expect(hideButton).not.toBeNull();

    await act(async () => {
      hideButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(toggle).toHaveBeenCalledWith("phone");

    const showButton = container.querySelector('button[aria-label="Show Email Address column"]');
    expect(showButton).not.toBeNull();

    await act(async () => {
      showButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(toggle).toHaveBeenCalledWith("email");
  });

  it("renders drag states and dispatches drag event callbacks on draggable items", async () => {
    const handleDragStart = vi.fn();
    const handleDragOver = vi.fn();
    const handleDrop = vi.fn();
    const clearDrag = vi.fn();

    await act(async () => {
      root.render(
        <ModuleColumnCustomizerList
          visibleColumns={mockVisible}
          hiddenColumns={[]}
          dragging="name"
          dragOver="phone"
          labels={mockLabels}
          toggle={vi.fn()}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          clearDrag={clearDrag}
        />,
      );
    });

    expect(container.innerHTML).toContain("opacity-40");
    expect(container.innerHTML).toContain("border-primary bg-primary/5");

    const draggableItem = container.querySelector('[draggable="true"]');
    expect(draggableItem).not.toBeNull();

    await act(async () => {
      draggableItem?.dispatchEvent(new Event("dragstart", { bubbles: true }));
      draggableItem?.dispatchEvent(new Event("dragover", { bubbles: true }));
      draggableItem?.dispatchEvent(new Event("drop", { bubbles: true }));
      draggableItem?.dispatchEvent(new Event("dragend", { bubbles: true }));
    });

    expect(handleDragStart).toHaveBeenCalled();
    expect(handleDragOver).toHaveBeenCalled();
    expect(handleDrop).toHaveBeenCalled();
    expect(clearDrag).toHaveBeenCalled();
  });
});
