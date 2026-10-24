import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Award } from "lucide-react";
import { FormCollectionShell } from "./FormCollectionShell";

describe("FormCollectionShell", () => {
  it("renders optional title, children, and add button", () => {
    const html = renderToStaticMarkup(
      <FormCollectionShell title="Holdings" icon={Award} addLabel="Designation" onAdd={vi.fn()}>
        <div data-testid="row">row</div>
      </FormCollectionShell>,
    );

    expect(html).toContain("Holdings");
    expect(html).toContain("row");
    expect(html).toContain("Designation");
    expect(html).toContain("border-dashed");
  });

  it("omits title and add button when not requested", () => {
    const html = renderToStaticMarkup(
      <FormCollectionShell addLabel="Item" onAdd={vi.fn()} allowAdd={false}>
        <div>body</div>
      </FormCollectionShell>,
    );

    expect(html).toContain("body");
    expect(html).not.toContain("border-dashed");
    expect(html).not.toContain("<h3");
  });
});
