import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionCard } from "./SectionCard";

describe("SectionCard", () => {
  it("renders with default primary accent stripe and insets", () => {
    const html = renderToStaticMarkup(
      <SectionCard title="Preferences Section">
        <p>Section Content</p>
      </SectionCard>,
    );

    expect(html).toContain("Preferences Section");
    expect(html).toContain("Section Content");
    expect(html).toContain("w-1.5");
    expect(html).toContain("ps-5 sm:ps-6");
  });

  it("renders with custom accent color", () => {
    const html = renderToStaticMarkup(
      <SectionCard title="Danger Zone" accentColor="destructive">
        <p>Warning Content</p>
      </SectionCard>,
    );

    expect(html).toContain("bg-destructive/45");
    expect(html).toContain("ps-5 sm:ps-6");
  });

  it("omits stripe when accentColor is false", () => {
    const html = renderToStaticMarkup(
      <SectionCard title="Plain Section" accentColor={false}>
        <p>Plain Content</p>
      </SectionCard>,
    );

    expect(html).not.toContain("bg-primary/45");
    expect(html).not.toContain("w-1.5");
  });
});
