import React, { act } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { ModuleTableSelectionCell } from "./ModuleTableSelectionCell";
import { Table, TableBody, TableRow } from "@/components/ui/table";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ModuleTableSelectionCell", () => {
  it("renders a sticky selection cell with checkbox and aria-label", () => {
    const onCheckedChange = vi.fn();
    const html = renderToStaticMarkup(
      <Table>
        <TableBody>
          <TableRow>
            <ModuleTableSelectionCell
              checked={false}
              onCheckedChange={onCheckedChange}
              ariaLabel="Select Contact"
            />
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(html).toContain('aria-label="Select Contact"');
    expect(html).toContain("sticky start-0");
  });

  it("applies selected background when checked", () => {
    const onCheckedChange = vi.fn();
    const html = renderToStaticMarkup(
      <Table>
        <TableBody>
          <TableRow>
            <ModuleTableSelectionCell
              checked={true}
              onCheckedChange={onCheckedChange}
              ariaLabel="Select Contact"
            />
          </TableRow>
        </TableBody>
      </Table>,
    );

    // Opaque pre-blended tint (was translucent `bg-primary/5`, which let scrolled cells show through).
    expect(html).toContain("bg-surface-sticky-selected");
  });

  it("renders checkbox with standard 16px (h-4 w-4) sizing matching table header", () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableBody>
          <TableRow>
            <ModuleTableSelectionCell
              checked={false}
              onCheckedChange={vi.fn()}
              ariaLabel="Select Row"
            />
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(html).toContain("h-4");
    expect(html).toContain("w-4");
    expect(html).not.toContain("h-6");
    expect(html).not.toContain("w-6");
  });

  describe("shift-click range selection", () => {
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

    it("toggles normally on a plain click", async () => {
      const onCheckedChange = vi.fn();
      const onShiftSelect = vi.fn();
      await act(async () => {
        root.render(
          <Table>
            <TableBody>
              <TableRow>
                <ModuleTableSelectionCell
                  checked={false}
                  onCheckedChange={onCheckedChange}
                  onShiftSelect={onShiftSelect}
                  ariaLabel="Select Row"
                />
              </TableRow>
            </TableBody>
          </Table>,
        );
      });

      const cell = container.querySelector("td") as HTMLElement;
      await act(async () => {
        cell.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(onCheckedChange).toHaveBeenCalledTimes(1);
      expect(onShiftSelect).not.toHaveBeenCalled();
    });

    it("routes shift+click on the cell to onShiftSelect instead of toggling", async () => {
      const onCheckedChange = vi.fn();
      const onShiftSelect = vi.fn();
      await act(async () => {
        root.render(
          <Table>
            <TableBody>
              <TableRow>
                <ModuleTableSelectionCell
                  checked={false}
                  onCheckedChange={onCheckedChange}
                  onShiftSelect={onShiftSelect}
                  ariaLabel="Select Row"
                />
              </TableRow>
            </TableBody>
          </Table>,
        );
      });

      const cell = container.querySelector("td") as HTMLElement;
      await act(async () => {
        cell.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }),
        );
      });

      expect(onShiftSelect).toHaveBeenCalledTimes(1);
      expect(onCheckedChange).not.toHaveBeenCalled();
    });

    it("suppresses the toggle when the checkbox button is shift-clicked", async () => {
      const onCheckedChange = vi.fn();
      const onShiftSelect = vi.fn();
      await act(async () => {
        root.render(
          <Table>
            <TableBody>
              <TableRow>
                <ModuleTableSelectionCell
                  checked={false}
                  onCheckedChange={onCheckedChange}
                  onShiftSelect={onShiftSelect}
                  ariaLabel="Select Row"
                />
              </TableRow>
            </TableBody>
          </Table>,
        );
      });

      const button = container.querySelector('button[role="checkbox"]') as HTMLElement;
      expect(button).not.toBeNull();

      await act(async () => {
        button.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, cancelable: true, shiftKey: true }),
        );
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(onShiftSelect).toHaveBeenCalledTimes(1);
      expect(onCheckedChange).not.toHaveBeenCalled();
    });
  });
});
