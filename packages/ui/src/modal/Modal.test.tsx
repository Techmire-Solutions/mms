import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Modal } from "./Modal";
import { ConfirmDialog } from "./AlertDialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Modal & ConfirmDialog components", () => {
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

  it("renders modal when open is true", async () => {
    const handleClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal open={true} onClose={handleClose} title="Create Workspace" subtitle="Fill in details">
          <div>Modal Body Content</div>
        </Modal>,
      );
    });

    expect(container.textContent).toContain("Create Workspace");
    expect(container.textContent).toContain("Fill in details");
    expect(container.textContent).toContain("Modal Body Content");
  });

  it("does not render when open is false", async () => {
    await act(async () => {
      root.render(
        <Modal open={false} onClose={vi.fn()} title="Hidden Modal">
          <div>Hidden Content</div>
        </Modal>,
      );
    });

    expect(container.textContent).not.toContain("Hidden Modal");
  });

  it("calls onClose when close button is clicked", async () => {
    const handleClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal open={true} onClose={handleClose} title="Test Modal">
          <div>Content</div>
        </Modal>,
      );
    });

    const closeBtn = container.querySelector("button[aria-label='Close']") as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders ConfirmDialog and handles confirm action", async () => {
    const handleConfirm = vi.fn();
    const handleOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <ConfirmDialog
          open={true}
          onOpenChange={handleOpenChange}
          title="Delete Item"
          description="Are you sure you want to delete this record?"
          variant="destructive"
          onConfirm={handleConfirm}
        />,
      );
    });

    // Radix AlertDialog renders into portal attached to document.body
    expect(document.body.textContent).toContain("Delete Item");
    expect(document.body.textContent).toContain("Are you sure you want to delete this record?");

    const buttons = Array.from(document.body.querySelectorAll("button"));
    const deleteBtn = buttons.find((b) => b.textContent?.includes("Delete"));
    expect(deleteBtn).toBeTruthy();
    deleteBtn?.click();
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
