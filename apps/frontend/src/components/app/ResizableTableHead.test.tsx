import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResizableTableHead } from "./ResizableTableHead";

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
});
