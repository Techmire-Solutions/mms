import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./Table";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Table component - Modern Web Guidance: responsive-table", () => {
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

  it("renders @container query class on scrollable container", async () => {
    await act(async () => {
      root.render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
    });

    const scrollWrapper = container.querySelector('[role="region"]');
    expect(scrollWrapper).not.toBeNull();
    expect(scrollWrapper?.className).toContain("@container");
    expect(scrollWrapper?.className).toContain("overflow-x-auto");
  });

  it("renders TableHead with sticky freeze column styling when isSticky is true", async () => {
    await act(async () => {
      root.render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead isSticky>Sticky Header</TableHead>
              <TableHead>Regular Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
    });

    const heads = container.querySelectorAll("th");
    expect(heads[0]?.className).toContain("sticky");
    expect(heads[0]?.className).toContain("inset-inline-start-0");
    expect(heads[0]?.className).toContain("z-20");
    expect(heads[1]?.className).not.toContain("inset-inline-start-0");
  });

  it("renders TableCell with isSticky as a rowheader and normal cell", async () => {
    await act(async () => {
      root.render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell asHeader isSticky>
                Employee Name
              </TableCell>
              <TableCell isSticky>Employee ID</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
    });

    const rowHeader = container.querySelector('th[role="rowheader"]');
    expect(rowHeader).not.toBeNull();
    expect(rowHeader?.className).toContain("sticky");
    expect(rowHeader?.className).toContain("inset-inline-start-0");
    expect(rowHeader?.className).toContain("z-1");

    const cells = container.querySelectorAll("td");
    expect(cells[0]?.className).toContain("sticky");
    expect(cells[0]?.className).toContain("inset-inline-start-0");
    expect(cells[1]?.className).not.toContain("inset-inline-start-0");
  });

  it("renders TableHeader with sticky-scroll-state when sticky is enabled", async () => {
    await act(async () => {
      root.render(
        <Table stickyHeader>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
    });

    const scrollWrapper = container.querySelector('[role="region"]');
    expect(scrollWrapper?.className).toContain("[overflow-anchor:none]");

    const thead = container.querySelector("thead");
    expect(thead?.className).toContain("sticky-scroll-state");
  });

  it("given a currency column, should end-align the header without the cells' mono numeric typography", async () => {
    // Arrange
    const render = () =>
      root.render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead variant="currency">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Aisha</TableCell>
              <TableCell variant="currency">1,200</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

    // Act
    await act(async () => {
      render();
    });
    const amountHead = container.querySelectorAll("th")[1] as HTMLTableCellElement;
    const amountCell = container.querySelectorAll("td")[1] as HTMLTableCellElement;

    // Assert
    expect(amountHead.classList.contains("text-end")).toBe(true);
    expect(amountHead.classList.contains("font-mono")).toBe(false);
    expect(amountCell.classList.contains("font-mono")).toBe(true);
  });
});
