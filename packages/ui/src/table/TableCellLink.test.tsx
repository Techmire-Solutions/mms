import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TableCellLink } from "./TableCellLink";

describe("TableCellLink Component (@shared/ui)", () => {
  it("renders a ghost button with zero padding and auto direction", () => {
    const html = renderToStaticMarkup(
      <TableCellLink>Student Name</TableCellLink>,
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('dir="auto"');
    expect(html).toContain("px-0");
    expect(html).toContain("py-0");
    expect(html).toContain("Student Name");
  });

  it("applies min-h-11 when tap is set for mobile accessibility", () => {
    const html = renderToStaticMarkup(
      <TableCellLink tap>Tap Target</TableCellLink>,
    );

    expect(html).toContain("min-h-11");
  });

  it("applies primary text color when selected with toggle", () => {
    const html = renderToStaticMarkup(
      <TableCellLink toggle selected>Selected Filter</TableCellLink>,
    );

    expect(html).toContain("text-primary");
    expect(html).toContain("hover:bg-transparent");
  });

  it("applies muted styling when muted is set", () => {
    const html = renderToStaticMarkup(
      <TableCellLink muted>Subtitle</TableCellLink>,
    );

    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("font-normal");
  });
});
