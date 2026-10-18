import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader Component (@shared/ui)", () => {
  it("renders h2 heading by default with title and subtitle", () => {
    const html = renderToStaticMarkup(
      <SectionHeader
        title="Fiscal Years"
        subtitle="Manage fiscal periods"
        headingId="fiscal-years-heading"
      />,
    );

    expect(html).toContain("<h2");
    expect(html).toContain('id="fiscal-years-heading"');
    expect(html).toContain("Fiscal Years");
    expect(html).toContain("Manage fiscal periods");
  });

  it("supports h3 heading level when specified", () => {
    const html = renderToStaticMarkup(
      <SectionHeader title="Sub-section" headingLevel={3} />,
    );

    expect(html).toContain("<h3");
    expect(html).not.toContain("<h2");
  });

  it("renders leading icon with aria-hidden", () => {
    const html = renderToStaticMarkup(
      <SectionHeader
        title="Settings"
        icon={<span data-testid="settings-icon">⚙</span>}
      />,
    );

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("settings-icon");
  });

  it("renders badge and action slots", () => {
    const html = renderToStaticMarkup(
      <SectionHeader
        title="Users"
        badge={<span data-testid="user-count">42</span>}
        actions={<button type="button">Add User</button>}
      />,
    );

    expect(html).toContain("user-count");
    expect(html).toContain("Add User");
  });
});
