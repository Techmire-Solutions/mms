import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleTableSelectionCell } from "./ModuleTableSelectionCell";
import { Table, TableBody, TableRow } from "@/components/ui/table";

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

    expect(html).toContain("bg-primary/5");
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
});

