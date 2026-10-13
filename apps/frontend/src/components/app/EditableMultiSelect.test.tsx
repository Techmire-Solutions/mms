import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditableMultiSelect } from "./EditableMultiSelect";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("EditableMultiSelect", () => {
  it("renders trigger button with chips and aria attributes", () => {
    const html = renderToStaticMarkup(
      <EditableMultiSelect
        options={["Donor", "Volunteer", "Staff"]}
        values={["Donor", "Volunteer"]}
        onChange={vi.fn()}
        id="contact-tags"
      />,
    );
    expect(html).toContain('id="contact-tags"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Donor");
    expect(html).toContain("Volunteer");
  });

  it("sets aria-invalid on trigger when error is true", () => {
    const html = renderToStaticMarkup(
      <EditableMultiSelect
        options={["Donor", "Volunteer"]}
        values={[]}
        onChange={vi.fn()}
        id="contact-tags"
        error={true}
      />,
    );
    expect(html).toContain('aria-invalid="true"');
  });
});
