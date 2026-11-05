import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  it("advertises the `/` shortcut by default", () => {
    const html = renderToStaticMarkup(<SearchBar value="" onChange={vi.fn()} />);
    expect(html).toContain('aria-keyshortcuts="/"');
  });

  it("omits the shortcut attribute when no handler exists", () => {
    const html = renderToStaticMarkup(
      <SearchBar value="" onChange={vi.fn()} keyshortcuts={null} />,
    );
    expect(html).not.toContain("aria-keyshortcuts");
  });

  it("forwards a custom shortcut descriptor", () => {
    const html = renderToStaticMarkup(
      <SearchBar value="" onChange={vi.fn()} keyshortcuts="Control+K" />,
    );
    expect(html).toContain('aria-keyshortcuts="Control+K"');
  });
});
