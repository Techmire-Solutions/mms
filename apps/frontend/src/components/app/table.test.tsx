import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableFooter,
  TableHead,
  TableHeadCell,
  TableHeader,
  TableRow,
  TableSkeleton,
  getTableCellWrapClass,
  getTableCellAlignClass,
  getAriaSort,
} from "../ui/table";

describe("table SSOT system", () => {
  describe("getTableCellWrapClass & getTableCellAlignClass", () => {
    it("returns default graceful text wrap classes when no overrides are given", () => {
      expect(getTableCellWrapClass()).toBe("whitespace-normal break-words max-w-prose");
      expect(getTableCellWrapClass(true)).toBe("whitespace-nowrap");
      expect(getTableCellWrapClass(false, true)).toBe("truncate max-w-xs");
    });

    it("resolves alignments and variants correctly", () => {
      expect(getTableCellAlignClass("end")).toBe("text-end font-mono tabular-nums");
      expect(getTableCellAlignClass(undefined, "number")).toBe("text-end font-mono tabular-nums");
      expect(getTableCellAlignClass(undefined, "currency")).toBe(
        "text-end font-mono tabular-nums font-semibold",
      );
      expect(getTableCellAlignClass("center")).toBe("text-center");
      expect(getTableCellAlignClass(undefined, "badge")).toBe("text-center");
      expect(getTableCellAlignClass(undefined, "action")).toBe("text-center");
      expect(getTableCellAlignClass("start")).toBe("text-start");
      expect(getTableCellAlignClass()).toBe("text-start");
    });

    it("resolves aria-sort mappings correctly", () => {
      expect(getAriaSort("asc")).toBe("ascending");
      expect(getAriaSort(true)).toBe("ascending");
      expect(getAriaSort("desc")).toBe("descending");
      expect(getAriaSort("none")).toBe("none");
      expect(getAriaSort(false)).toBe("none");
      expect(getAriaSort(null)).toBeUndefined();
      expect(getAriaSort()).toBeUndefined();
    });
  });

  describe("semantic ARIA roles & accessibility", () => {
    it("renders semantic ARIA roles on headers, rows, and cells", () => {
      const html = renderToStaticMarkup(
        <Table scrollRegionLabel="Student directory">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Ali</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="Student directory"');
      expect(html).toContain('role="table"');
      expect(html).toContain('role="row"');
      expect(html).toContain('role="columnheader"');
      expect(html).toContain('role="cell"');
    });

    it('renders scope="col" on every <th> for WCAG column header semantics', () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead variant="number">Amount</TableHead>
              <TableHead variant="badge">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>–</TableCell>
              <TableCell>–</TableCell>
              <TableCell>–</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      const matches = html.match(/scope="col"/g);
      expect(matches).toHaveLength(3);
    });

    it('renders row headers with scope="row" and role="rowheader" when asHeader is set', () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell asHeader>Row Title</TableCell>
              <TableCell>Row Data</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(html).toContain('role="rowheader"');
      expect(html).toContain('scope="row"');
      expect(html).toContain("<th");
    });

    it("supports keyboard focus on focusable rows and cells", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableBody>
            <TableRow isFocusable>
              <TableCell isFocusable>Focusable cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(html).toContain('tabindex="0"');
      expect(html).toContain("focus-visible:ring-2");
      expect(html).toContain("cursor-pointer");
    });
  });

  describe("three-state sorting indicators & TableHeadCell", () => {
    it("renders TableHeadCell alias with identical behavior to TableHead", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeadCell>Column</TableHeadCell>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(html).toContain('role="columnheader"');
      expect(html).toContain('scope="col"');
      expect(html).toContain("Column");
    });

    it("renders ascending, descending, and none sort states with aria-sort", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead sortDirection="asc" sortable>
                Ascending Col
              </TableHead>
              <TableHead sortDirection="desc" sortable>
                Descending Col
              </TableHead>
              <TableHead sortDirection="none" sortable>
                Neutral Col
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(html).toContain('aria-sort="ascending"');
      expect(html).toContain('aria-sort="descending"');
      expect(html).toContain('aria-sort="none"');
      expect(html).toContain("lucide-arrow-up");
      expect(html).toContain("lucide-arrow-down");
      expect(html).toContain("lucide-arrow-up-down");
    });

    it("renders accessible button trigger when onSort is provided", () => {
      const onSortMock = () => {};
      const html = renderToStaticMarkup(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead sortDirection="asc" onSort={onSortMock}>
                Sortable Header
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(html).toContain('<button type="button"');
      expect(html).toContain("Sortable Header");
      expect(html).toContain('aria-sort="ascending"');
    });
  });

  describe("standardized alignments & variants", () => {
    it("aligns numbers and currency to the right with font-mono", () => {
      const cellHtml = renderToStaticMarkup(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell variant="currency">$1,200.00</TableCell>
              <TableCell variant="number">42</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(cellHtml).toContain("text-end");
      expect(cellHtml).toContain("font-mono");
      expect(cellHtml).toContain("tabular-nums");
      expect(cellHtml).toContain("font-semibold");
    });

    it("aligns badges and actions to the center", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead variant="badge">Status</TableHead>
              <TableHead variant="action">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell variant="badge">Active</TableCell>
              <TableCell variant="action">Edit</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(html).toContain("text-center");
    });
  });

  describe("sticky headers & responsive wrapper", () => {
    it("applies sticky header styles when stickyHeader is true on Table or sticky on TableHeader", () => {
      const html = renderToStaticMarkup(
        <Table stickyHeader>
          <TableHeader>
            <TableRow>
              <TableHead>Sticky Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(html).toContain("sticky top-0");
      expect(html).toContain("z-10");
      expect(html).toContain("backdrop-blur-xs");
    });

    it("applies sticky footer styles when sticky prop is set on TableFooter", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Row</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter sticky>
            <TableRow>
              <TableCell>Total</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );
      expect(html).toContain("sticky bottom-0");
      expect(html).toContain("z-10");
    });

    it("does NOT apply sticky footer styles by default (non-sticky)", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Row</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );
      expect(html).not.toContain("sticky bottom-0");
    });

    it("wraps table in responsive horizontal scroll wrapper", () => {
      const html = renderToStaticMarkup(
        <Table containerClassName="custom-scroll-container">
          <TableBody>
            <TableRow>
              <TableCell>Item</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(html).toContain("overflow-x-auto");
      expect(html).toContain("custom-scroll-container");
    });
  });

  describe("text wrapping defaults & overrides", () => {
    it("applies graceful default wrapping, noWrap override, and truncate override with auto title", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Default wrapping text</TableCell>
              <TableCell noWrap>No wrap fixed id</TableCell>
              <TableCell truncate>Truncated long text</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(html).toContain("whitespace-normal break-words max-w-prose");
      expect(html).toContain("whitespace-nowrap");
      expect(html).toContain("truncate max-w-xs");
      expect(html).toContain('title="Truncated long text"');
    });
  });

  describe("TableEmpty — dedicated slots for Zero Data vs Empty Search", () => {
    it("renders zero-data empty state with colSpan", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableBody>
            <TableEmpty colSpan={5} variant="zero-data" />
          </TableBody>
        </Table>,
      );
      expect(html).toContain('colSpan="5"');
      expect(html).toContain("No records found");
      expect(html).toContain("lucide-inbox");
    });

    it("renders empty-search empty state with colSpan and custom action", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableBody>
            <TableEmpty
              colSpan={4}
              variant="empty-search"
              title="No students matched"
              action={<button type="button">Reset</button>}
            />
          </TableBody>
        </Table>,
      );
      expect(html).toContain('colSpan="4"');
      expect(html).toContain("No students matched");
      expect(html).toContain("lucide-search-x");
      expect(html).toContain('<button type="button">Reset</button>');
    });
  });

  describe("TableSkeleton — layout-preserving loader", () => {
    it("renders correct number of skeleton rows and columns", () => {
      const html = renderToStaticMarkup(<TableSkeleton columns={3} rows={4} />);
      const tdMatches = html.match(/<td /g);
      expect(tdMatches).toHaveLength(12);
    });

    it("renders with role=status and aria-label for screen readers", () => {
      const html = renderToStaticMarkup(<TableSkeleton columns={2} />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-label="Loading table data"');
      expect(html).toContain("Loading…");
    });

    it("applies animate-pulse shimmer class on skeleton cells", () => {
      const html = renderToStaticMarkup(<TableSkeleton columns={2} rows={2} />);
      expect(html).toContain("animate-pulse");
    });

    it("applies columnWidths as inline styles on invisible header cells", () => {
      const html = renderToStaticMarkup(<TableSkeleton columns={2} columnWidths={[120, 80]} />);
      expect(html).toContain("width:120px");
      expect(html).toContain("width:80px");
    });

    it("marks the invisible header as aria-hidden", () => {
      const html = renderToStaticMarkup(<TableSkeleton columns={2} />);
      expect(html).toContain('aria-hidden="true"');
    });

    it("defaults to 5 rows and 5 columns when props are omitted", () => {
      const html = renderToStaticMarkup(<TableSkeleton />);
      const tdMatches = html.match(/<td /g);
      expect(tdMatches).toHaveLength(25);
    });

    it("supports cols alias for columns", () => {
      const html = renderToStaticMarkup(<TableSkeleton cols={4} rows={3} />);
      const tdMatches = html.match(/<td /g);
      expect(tdMatches).toHaveLength(12);
    });
  });
});
