import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleTableHeaderCell } from "./ModuleTableHeaderCell";

describe("ModuleTableHeaderCell", () => {
  it("renders basic column header children and styles", () => {
    const html = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ModuleTableHeaderCell columnKey="name">Name</ModuleTableHeaderCell>
          </tr>
        </thead>
      </table>,
    );

    expect(html).toContain("Name");
    expect(html).toContain("<th");
  });

  it("renders sort button and handles asc/desc chevrons", () => {
    const onSort = vi.fn();
    const htmlAsc = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ModuleTableHeaderCell
              columnKey="name"
              sortKey="name"
              activeSortField="name"
              sortDir="asc"
              onSort={onSort}
            >
              Name
            </ModuleTableHeaderCell>
          </tr>
        </thead>
      </table>,
    );

    expect(htmlAsc).toContain('aria-sort="ascending"');
    expect(htmlAsc).toContain("<button");

    const htmlDesc = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ModuleTableHeaderCell
              columnKey="name"
              sortKey="name"
              activeSortField="name"
              sortDir="desc"
              onSort={onSort}
            >
              Name
            </ModuleTableHeaderCell>
          </tr>
        </thead>
      </table>,
    );

    expect(htmlDesc).toContain('aria-sort="descending"');
  });

  it("supports right/end alignment and center variants", () => {
    const htmlEnd = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ModuleTableHeaderCell
              columnKey="amount"
              sortKey="amount"
              align="end"
              variant="currency"
              onSort={vi.fn()}
            >
              Amount
            </ModuleTableHeaderCell>
          </tr>
        </thead>
      </table>,
    );

    expect(htmlEnd).toContain("justify-end");

    const htmlCenter = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ModuleTableHeaderCell
              columnKey="status"
              sortKey="status"
              align="center"
              onSort={vi.fn()}
            >
              Status
            </ModuleTableHeaderCell>
          </tr>
        </thead>
      </table>,
    );

    expect(htmlCenter).toContain("justify-center");
  });

  it("renders drop indicator if provided", () => {
    const html = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ModuleTableHeaderCell
              columnKey="phone"
              dropIndicator={<span data-testid="drop-indicator">indicator</span>}
            >
              Phone
            </ModuleTableHeaderCell>
          </tr>
        </thead>
      </table>,
    );

    expect(html).toContain('data-testid="drop-indicator"');
  });

  it("handles clicking sort button and respects suppressSortClick", () => {
    const onSort = vi.fn();
    const suppressSortClick = { current: false };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <table>
          <thead>
            <tr>
              <ModuleTableHeaderCell
                columnKey="name"
                sortKey="name"
                activeSortField="name"
                sortDir="desc"
                onSort={onSort}
                suppressSortClick={suppressSortClick}
              >
                Name
              </ModuleTableHeaderCell>
            </tr>
          </thead>
        </table>,
      );
    });

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button).toBeTruthy();

    act(() => {
      button.click();
    });
    expect(onSort).toHaveBeenCalledWith("name");

    // When suppressSortClick is true
    suppressSortClick.current = true;
    onSort.mockClear();
    act(() => {
      button.click();
    });
    expect(onSort).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("given a sortable column, should keep the header's uppercase casing on the sort button", () => {
    // Arrange
    const html = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <ModuleTableHeaderCell columnKey="name" sortKey="name" onSort={() => undefined}>
              Name
            </ModuleTableHeaderCell>
          </tr>
        </thead>
      </table>,
    );

    // Act
    const button = new DOMParser().parseFromString(html, "text/html").querySelector("th button");

    // Assert
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button?.classList.contains("uppercase")).toBe(true);
  });
});
