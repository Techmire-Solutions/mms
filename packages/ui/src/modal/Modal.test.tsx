import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";
import { ConfirmDialog } from "./AlertDialog";

describe("Modal & ConfirmDialog components", () => {
  it("renders modal when open is true", () => {
    const handleClose = vi.fn();
    render(
      <Modal open={true} onClose={handleClose} title="Create Workspace" subtitle="Fill in details">
        <div>Modal Body Content</div>
      </Modal>,
    );

    expect(screen.getByText("Create Workspace")).toBeDefined();
    expect(screen.getByText("Fill in details")).toBeDefined();
    expect(screen.getByText("Modal Body Content")).toBeDefined();
  });

  it("does not render when open is false", () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Hidden Modal">
        <div>Hidden Content</div>
      </Modal>,
    );

    expect(screen.queryByText("Hidden Modal")).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <Modal open={true} onClose={handleClose} title="Test Modal">
        <div>Content</div>
      </Modal>,
    );

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders ConfirmDialog and handles confirm action", () => {
    const handleConfirm = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Delete Item"
        description="Are you sure you want to delete this record?"
        variant="destructive"
        onConfirm={handleConfirm}
      />,
    );

    expect(screen.getByText("Delete Item")).toBeDefined();
    expect(screen.getByText("Are you sure you want to delete this record?")).toBeDefined();

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
