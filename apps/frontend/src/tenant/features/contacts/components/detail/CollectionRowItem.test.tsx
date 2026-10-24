import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionRowItem } from "./CollectionRowItem";

describe("CollectionRowItem Component", () => {
  it("renders row item with label and value", () => {
    const html = renderToStaticMarkup(<CollectionRowItem label="Mobile" value="+92 300 1234567" />);

    expect(html).toContain("Mobile");
    expect(html).toContain("+92 300 1234567");
  });
});
