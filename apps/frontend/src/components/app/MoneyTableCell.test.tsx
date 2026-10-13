import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Table, TableBody, TableRow } from "@/components/ui/table";
import { MoneyTableCell } from "@/components/ui/MoneyTableCell";

function renderCell(element: React.ReactElement): string {
  return renderToStaticMarkup(
    <Table>
      <TableBody>
        <TableRow>{element}</TableRow>
      </TableBody>
    </Table>,
  );
}

describe("MoneyTableCell", () => {
  it("renders neutral amount cell with table-amount-cell class", () => {
    const html = renderCell(<MoneyTableCell value="1,250.00" />);
    expect(html).toContain("1,250.00");
    expect(html).toContain("table-amount-cell");
    expect(html).toContain("text-foreground");
  });

  it("renders debit variant with text-info styling", () => {
    const html = renderCell(<MoneyTableCell value="500.00" variant="debit" />);
    expect(html).toContain("500.00");
    expect(html).toContain("text-info");
  });

  it("renders credit variant with text-success styling", () => {
    const html = renderCell(<MoneyTableCell value="500.00" variant="credit" />);
    expect(html).toContain("500.00");
    expect(html).toContain("text-success");
  });

  it("renders negative variant with text-destructive styling", () => {
    const html = renderCell(<MoneyTableCell value="-250.00" variant="negative" />);
    expect(html).toContain("-250.00");
    expect(html).toContain("text-destructive");
  });

  it("applies text-xs and custom className when isFooter is true", () => {
    const html = renderCell(
      <MoneyTableCell value="1,000.00" variant="credit" isFooter className="custom-footer" />,
    );
    expect(html).toContain("text-xs");
    expect(html).toContain("custom-footer");
  });
});
