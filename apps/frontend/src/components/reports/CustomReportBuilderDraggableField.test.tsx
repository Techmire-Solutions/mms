import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DraggableField } from "./CustomReportBuilderDraggableField";

describe("DraggableField Component", () => {
  it("renders draggable field item with field name and control buttons", () => {
    const html = renderToStaticMarkup(
      <DraggableField
        field="Full Name"
        onRemove={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        isFirst={false}
        isLast={false}
      />,
    );

    expect(html).toContain("Full Name");
    expect(html).toContain("reports.builder.moveUp");
    expect(html).toContain("reports.builder.moveDown");
    expect(html).toContain("reports.builder.removeField");
  });

  it("disables move-up when isFirst is true and move-down when isLast is true", () => {
    const html = renderToStaticMarkup(
      <DraggableField
        field="Status"
        onRemove={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        isFirst={true}
        isLast={true}
      />,
    );

    expect(html).toContain("disabled");
  });
});
