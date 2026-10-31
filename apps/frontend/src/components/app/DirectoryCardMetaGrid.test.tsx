import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DirectoryCardMetaGrid } from "./DirectoryCardMetaGrid";

describe("DirectoryCardMetaGrid", () => {
  it("renders metadata tiles in two columns at every width", () => {
    // Regression guard for the 2026-10-31 review (UX-17): a single column below
    // `sm` made each 7-tile mobile card's metadata 407px tall.
    const html = renderToStaticMarkup(
      <DirectoryCardMetaGrid>
        <div>Tier</div>
        <div>Status</div>
      </DirectoryCardMetaGrid>,
    );

    expect(html).toContain("grid-cols-2");
    expect(html).not.toContain("grid-cols-1");
  });
});
