import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailSectionCard } from "./DetailSectionCard";

describe("DetailSectionCard", () => {
  it("renders title, children, and optional className", () => {
    const html = renderToStaticMarkup(
      <DetailSectionCard title="Notes" className="divide-y" accentColor="info">
        <p>Body</p>
      </DetailSectionCard>,
    );

    expect(html).toContain("Notes");
    expect(html).toContain("Body");
    expect(html).toContain("divide-y");
  });

  it("renders optional count pill", () => {
    const html = renderToStaticMarkup(
      <DetailSectionCard title="Tags" count={3}>
        <span>a</span>
      </DetailSectionCard>,
    );

    expect(html).toContain("Tags");
    expect(html).toContain("3");
  });
});
