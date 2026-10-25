import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DirectoryCardFooterActions } from "./DirectoryCardFooterActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("DirectoryCardFooterActions", () => {
  it("renders view button and trailing actions", () => {
    const html = renderToStaticMarkup(
      <DirectoryCardFooterActions
        onView={vi.fn()}
        viewLabel="View Profile"
        viewAriaLabel="View Profile - Student"
        overflowActions={<button type="button">Overflow</button>}
      />,
    );

    expect(html).toContain("View Profile");
    expect(html).toContain('aria-label="View Profile - Student"');
    expect(html).toContain("Overflow");
  });

  it("renders leading slot when provided", () => {
    const html = renderToStaticMarkup(
      <DirectoryCardFooterActions leading={<span data-testid="leading-pill">SMS Sent</span>} />,
    );

    expect(html).toContain("leading-pill");
    expect(html).toContain("SMS Sent");
  });

  it("renders intermediate actions slot between view button and overflowActions", () => {
    const html = renderToStaticMarkup(
      <DirectoryCardFooterActions
        onView={vi.fn()}
        viewLabel="View"
        actions={<button type="button">Print</button>}
        overflowActions={<button type="button">Menu</button>}
      />,
    );

    expect(html).toContain("View");
    expect(html).toContain("Print");
    expect(html).toContain("Menu");
    expect(html.indexOf("View")).toBeLessThan(html.indexOf("Print"));
    expect(html.indexOf("Print")).toBeLessThan(html.indexOf("Menu"));
  });
});
