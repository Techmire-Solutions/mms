import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResizableTableHead } from "./ResizableTableHead";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/ui/app/measureColumnAutoFitWidth", () => ({
  measureColumnAutoFitWidth: vi.fn(() => 150),
}));

describe("ResizableTableHead", () => {
  it("treats a zero width as auto instead of collapsing the column", () => {
    const html = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ResizableTableHead columnKey="name" width={0}>
              Name
            </ResizableTableHead>
          </tr>
        </thead>
      </table>,
    );

    expect(html).not.toContain("width:0px");
    expect(html).not.toContain("min-width:0px");
  });

  it("applies an explicit positive width", () => {
    const html = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ResizableTableHead columnKey="name" width={220}>
              Name
            </ResizableTableHead>
          </tr>
        </thead>
      </table>,
    );

    expect(html).toContain("width:220px");
  });

  it("given a currency column, should end-align the header without mono numeric typography", () => {
    // Arrange
    const html = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ResizableTableHead columnKey="amount" variant="currency">
              Amount
            </ResizableTableHead>
          </tr>
        </thead>
      </table>,
    );

    // Act
    const th = new DOMParser()
      .parseFromString(`<table>${html}</table>`, "text/html")
      .querySelector("th");

    // Assert
    expect(th?.classList.contains("text-end")).toBe(true);
    expect(th?.classList.contains("font-mono")).toBe(false);
  });

  describe("interactive resizing and auto-fit", () => {
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

    it("handles pointer drag and resizes column", async () => {
      const onResize = vi.fn();

      await act(async () => {
        root.render(
          <table>
            <thead>
              <tr>
                <ResizableTableHead columnKey="title" width={120} onResize={onResize}>
                  Title
                </ResizableTableHead>
              </tr>
            </thead>
          </table>,
        );
      });

      const handle = container.querySelector('[role="separator"]') as HTMLElement;
      expect(handle).not.toBeNull();

      // Start drag
      await act(async () => {
        const pointerDown = new Event("pointerdown", { bubbles: true, cancelable: true });
        Object.assign(pointerDown, { clientX: 100 });
        handle.dispatchEvent(pointerDown);
      });

      // Pointer move
      await act(async () => {
        const pointerMove = new Event("pointermove", { bubbles: true, cancelable: true });
        Object.assign(pointerMove, { clientX: 140 });
        window.dispatchEvent(pointerMove);
      });

      // Pointer up
      await act(async () => {
        const pointerUp = new Event("pointerup", { bubbles: true, cancelable: true });
        Object.assign(pointerUp, { clientX: 140 });
        window.dispatchEvent(pointerUp);
      });

      expect(onResize).toHaveBeenCalledWith("title", 160);
    });

    it("handles double click for column auto-fit", async () => {
      const onResize = vi.fn();

      await act(async () => {
        root.render(
          <table>
            <thead>
              <tr>
                <ResizableTableHead columnKey="description" width={100} onResize={onResize}>
                  Description
                </ResizableTableHead>
              </tr>
            </thead>
          </table>,
        );
      });

      const handle = container.querySelector('[role="separator"]') as HTMLElement;
      expect(handle).not.toBeNull();

      await act(async () => {
        handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      });

      expect(onResize).toHaveBeenCalledWith("description", 150);
    });

    it("resizes from the keyboard with Arrow keys (LTR)", async () => {
      const onResize = vi.fn();

      await act(async () => {
        root.render(
          <table>
            <thead>
              <tr>
                <ResizableTableHead columnKey="title" width={120} onResize={onResize}>
                  Title
                </ResizableTableHead>
              </tr>
            </thead>
          </table>,
        );
      });

      const handle = container.querySelector('[role="separator"]') as HTMLElement;
      expect(handle).not.toBeNull();
      expect(handle.getAttribute("tabindex")).toBe("0");

      await act(async () => {
        handle.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
        );
      });
      expect(onResize).toHaveBeenLastCalledWith("title", 128);

      await act(async () => {
        handle.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }),
        );
      });
      expect(onResize).toHaveBeenLastCalledWith("title", 112);
    });

    it("jumps to min/max from Home/End keys", async () => {
      const onResize = vi.fn();

      await act(async () => {
        root.render(
          <table>
            <thead>
              <tr>
                <ResizableTableHead columnKey="title" width={200} onResize={onResize}>
                  Title
                </ResizableTableHead>
              </tr>
            </thead>
          </table>,
        );
      });

      const handle = container.querySelector('[role="separator"]') as HTMLElement;

      await act(async () => {
        handle.dispatchEvent(
          new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }),
        );
      });
      expect(onResize).toHaveBeenLastCalledWith("title", 640);

      await act(async () => {
        handle.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }),
        );
      });
      expect(onResize).toHaveBeenLastCalledWith("title", 80);
    });
  });
});
