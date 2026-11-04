import { describe, expect, it } from "vitest";
import { isConfirmDialogOpen, isOverlayOpen, isTypingTarget } from "./keyboardGuards";

describe("keyboardGuards", () => {
  it("treats text-entry controls as typing targets", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    const button = document.createElement("button");

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(select)).toBe(true);
    expect(isTypingTarget(button)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("detects an open modal, drawer, or command palette", () => {
    expect(isOverlayOpen()).toBe(false);

    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
    expect(isOverlayOpen()).toBe(true);
    modal.remove();

    const drawer = document.createElement("div");
    drawer.setAttribute("role", "dialog");
    document.body.appendChild(drawer);
    expect(isOverlayOpen()).toBe(true);
    drawer.remove();

    expect(isOverlayOpen()).toBe(false);
  });

  it("distinguishes a confirmation dialog from the dialog it confirms over", () => {
    expect(isConfirmDialogOpen()).toBe(false);

    const formDialog = document.createElement("div");
    formDialog.setAttribute("role", "dialog");
    document.body.appendChild(formDialog);
    expect(isOverlayOpen()).toBe(true);
    // An open form is not an unanswered confirmation: save shortcuts still work.
    expect(isConfirmDialogOpen()).toBe(false);

    const confirm = document.createElement("div");
    confirm.setAttribute("role", "alertdialog");
    document.body.appendChild(confirm);
    expect(isConfirmDialogOpen()).toBe(true);

    confirm.remove();
    formDialog.remove();
    expect(isConfirmDialogOpen()).toBe(false);
  });
});
