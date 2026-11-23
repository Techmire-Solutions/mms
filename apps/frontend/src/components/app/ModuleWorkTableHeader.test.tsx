import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleWorkTableHeader } from "./ModuleWorkTableHeader";

describe("ModuleWorkTableHeader", () => {
  const columns = [
    { id: "name", label: "Name" },
    { id: "gender", label: "Gender" },
    { id: "phone", label: "Phone" },
  ];

  it("renders non-sticky columns with draggable when onReorderColumns is provided", () => {
    const onReorder = vi.fn();
    const html = renderToStaticMarkup(
      <table>
        <ModuleWorkTableHeader
          columns={columns}
          stickyColumnId="name"
          getColumnWidth={() => 100}
          setColumnWidth={vi.fn()}
          onReorderColumns={onReorder}
        />
      </table>,
    );

    // stickyColumnId "name" should NOT be draggable
    const nameMatch = /<th[^>]*>[\s\S]*?Name[\s\S]*?<\/th>/.exec(html)?.[0];
    expect(nameMatch).not.toContain('draggable="true"');

    // non-sticky columns "gender" and "phone" should be draggable
    const genderMatch = /<th[^>]*>[\s\S]*?Gender[\s\S]*?<\/th>/.exec(html)?.[0];
    expect(genderMatch).toContain('draggable="true"');
    expect(genderMatch).toContain("cursor-grab");

    const phoneMatch = /<th[^>]*>[\s\S]*?Phone[\s\S]*?<\/th>/.exec(html)?.[0];
    expect(phoneMatch).toContain('draggable="true"');
  });

  it("does not render draggable attributes when onReorderColumns is omitted", () => {
    const html = renderToStaticMarkup(
      <table>
        <ModuleWorkTableHeader
          columns={columns}
          stickyColumnId="name"
          getColumnWidth={() => 100}
          setColumnWidth={vi.fn()}
        />
      </table>,
    );

    expect(html).not.toContain('draggable="true"');
  });
});
