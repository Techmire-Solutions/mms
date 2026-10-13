import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateEditor } from "../TemplateEditor";
import type { DocumentTemplate } from "@mms/shared";

/**
 * Interaction tests for the editor's keyboard model.
 *
 * The other suites in this folder are `renderToStaticMarkup` snapshots, which cannot
 * observe a key press at all — and the three regressions guarded here were all invisible
 * to them:
 *
 *  1. Enter/Space on a focused canvas element did nothing, because the handler re-used
 *     the pointer path (`onMouseDownElement` bails on `event.button !== 0`, and a
 *     KeyboardEvent has no `button`), so the whole editor was mouse-only.
 *  2. The global Space handler called `preventDefault()` on `window` for any target that
 *     was not an input, which swallowed Space on every button in the editor.
 *  3. Escape closed the editor even when the press was meant to clear the selection.
 */

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: "en",
    isLoading: false,
    dir: "ltr",
    isRtl: false,
  }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({ logoUrl: null, primaryColor: "#059669", secondaryColor: "#047857" }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const template: DocumentTemplate = {
  pageSize: "A5",
  orientation: "portrait",
  elements: [
    { id: "el_1", type: "static", label: "Invoice Title", x: 20, y: 20, w: 200, h: 20 },
    {
      id: "el_2",
      type: "field",
      field: "studentName",
      label: "Student Name",
      x: 20,
      y: 50,
      w: 200,
      h: 20,
    },
  ],
};

let container: HTMLDivElement;
let root: Root;

async function mountEditor(onClose = vi.fn()): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<TemplateEditor template={template} onClose={onClose} />);
  });
  return container;
}

function keydown(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  return act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });
}

function canvasRegion(): HTMLElement {
  const region = container.querySelector<HTMLElement>(
    '[aria-label="templateEditor.canvasViewport"]',
  );
  if (!region) throw new Error("canvas region not found");
  return region;
}

function elementByLabel(label: string): HTMLElement {
  const el = Array.from(
    container.querySelectorAll<HTMLElement>("[role='button'][aria-label]"),
  ).find((node) => node.getAttribute("aria-label") === label);
  if (!el) throw new Error(`canvas element "${label}" not found`);
  return el;
}

/** The inspector shows an empty hint until something is selected. */
function inspectorShowsEmptyState(): boolean {
  return container.textContent?.includes("templateEditor.emptyHint") ?? false;
}

describe("TemplateEditor keyboard interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("selects a canvas element with Enter and reveals its properties", async () => {
    await mountEditor();
    expect(inspectorShowsEmptyState()).toBe(true);

    const element = elementByLabel("Invoice Title (static)");
    await keydown(element, "Enter");

    expect(element.getAttribute("aria-pressed")).toBe("true");
    expect(inspectorShowsEmptyState()).toBe(false);
    expect(container.textContent).toContain("templateEditor.positionSize");
  });

  it("selects a canvas element with Space without arming canvas panning", async () => {
    await mountEditor();
    const element = elementByLabel("Student Name (field)");

    // Only one element is a tab stop (the selection or the first element), so this one
    // is reached by selection/arrow keys rather than Tab — Space must select it anyway.
    expect(element.getAttribute("tabindex")).toBe("-1");

    await keydown(element, " ");

    expect(element.getAttribute("aria-pressed")).toBe("true");
    expect(canvasRegion().className).not.toContain("cursor-grab");
  });

  it("does not swallow Space on ordinary buttons (native activation stays intact)", async () => {
    await mountEditor();

    const guidesToggle = Array.from(container.querySelectorAll<HTMLElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "templateEditor.toggleGuides",
    );
    expect(guidesToggle).toBeTruthy();

    await keydown(guidesToggle!, " ");

    /*
     * The guard is what keeps Space usable: `preventDefault()` on the keydown default
     * action is what would stop a button from activating. It must also not leave the
     * canvas in pan mode.
     */
    expect(canvasRegion().className).not.toContain("cursor-grab");
  });

  it("clears the selection on Escape without closing the editor", async () => {
    const onClose = vi.fn();
    await mountEditor(onClose);
    await keydown(elementByLabel("Invoice Title (static)"), "Enter");
    expect(inspectorShowsEmptyState()).toBe(false);

    await keydown(document.body, "Escape");

    expect(inspectorShowsEmptyState()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("recovers focus and announces when an element is deleted", async () => {
    await mountEditor();
    await keydown(elementByLabel("Invoice Title (static)"), "Enter");

    const panel = container.querySelector<HTMLElement>('[aria-label="templateEditor.properties"]');
    const deleteButton = Array.from(panel?.querySelectorAll<HTMLElement>("button") ?? []).find(
      (button) => button.getAttribute("aria-label") === "templateEditor.delete",
    );
    expect(deleteButton).toBeTruthy();

    await act(async () => {
      deleteButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The element is gone...
    expect(
      Array.from(container.querySelectorAll("[aria-label]")).some(
        (node) => node.getAttribute("aria-label") === "Invoice Title (static)",
      ),
    ).toBe(false);

    /*
     * ...the trash button that was activated no longer exists, so focus must land
     * somewhere stable instead of falling to <body>, and the removal must be announced:
     * an element silently disappearing is invisible to a screen-reader user.
     */
    expect(document.activeElement).toBe(canvasRegion());
    const statusMessages = Array.from(container.querySelectorAll('[role="status"]')).map(
      (node) => node.textContent ?? "",
    );
    expect(statusMessages.some((text) => text.includes("templateEditor.elementDeleted"))).toBe(
      true,
    );
  });

  it("treats a burst of typing as one undo step", async () => {
    await mountEditor();
    await keydown(elementByLabel("Invoice Title (static)"), "Enter");

    const labelInput = container.querySelector<HTMLInputElement>("#label-input-el_1");
    if (!labelInput) throw new Error("label input not found after selecting the element");

    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;

    // Three keystrokes, as React sees them.
    for (const value of ["Invoi", "Invoic", "Invoice T"]) {
      await act(async () => {
        nativeValueSetter.call(labelInput, value);
        labelInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    expect(labelInput.value).toBe("Invoice T");

    /*
     * One undo must revert the whole typed burst. Before coalescing, every keystroke
     * pushed its own history entry — a 14-character label consumed 14 of the 30 undo
     * slots, and a single label edit could flush a whole design session's history.
     */
    await keydown(document.body, "z", { ctrlKey: true });
    expect(labelInput.value).toBe("Invoice Title");
  });

  it("keeps the scrollable canvas region keyboard focusable in preview mode", async () => {
    await mountEditor();
    // Preview mode removes every canvas element from the tab order, so the region
    // itself must be reachable or the page cannot be scrolled by keyboard.
    expect(canvasRegion().getAttribute("tabindex")).toBe("0");
  });

  it("given a click with slight pointer jitter, should select the element without nudging it or dirtying the template", async () => {
    // Arrange
    await mountEditor();
    const element = elementByLabel("Invoice Title (static)");
    const leftBefore = element.style.left;
    const press = { bubbles: true, cancelable: true, button: 0, clientX: 50, clientY: 30 };

    // Act
    await act(async () => {
      element.dispatchEvent(new MouseEvent("mousedown", press));
      window.dispatchEvent(new PointerEvent("pointermove", { ...press, clientX: 52, clientY: 31 }));
      window.dispatchEvent(new PointerEvent("pointerup", press));
    });

    // Assert
    expect(element.getAttribute("aria-pressed")).toBe("true");
    expect(inspectorShowsEmptyState()).toBe(false);
    expect(element.style.left).toBe(leftBefore);
    expect(container.textContent).not.toContain("templateEditor.dirtyNotice");
  });
});
