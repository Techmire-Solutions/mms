import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormSelectWithQuickCreate } from "./FormSelectWithQuickCreate";

describe("FormSelectWithQuickCreate", () => {
  it("renders Plus when canAdd and onOpenAdd are set", () => {
    const html = renderToStaticMarkup(
      <FormSelectWithQuickCreate
        id="dept"
        value=""
        onChange={vi.fn()}
        options={[{ value: "a", label: "A" }]}
        canAdd
        onOpenAdd={vi.fn()}
        addAriaLabel="Add department"
      />,
    );
    expect(html).toContain('aria-label="Add department"');
    expect(html).toContain("lucide-plus");
  });

  it("hides Plus when canAdd is false or disabled", () => {
    const withoutAdd = renderToStaticMarkup(
      <FormSelectWithQuickCreate
        id="dept"
        value=""
        onChange={vi.fn()}
        options={[]}
        addAriaLabel="Add department"
      />,
    );
    expect(withoutAdd).not.toContain('aria-label="Add department"');

    const disabled = renderToStaticMarkup(
      <FormSelectWithQuickCreate
        id="dept"
        value=""
        onChange={vi.fn()}
        options={[]}
        canAdd
        onOpenAdd={vi.fn()}
        addAriaLabel="Add department"
        disabled
      />,
    );
    expect(disabled).not.toContain('aria-label="Add department"');
  });
});
