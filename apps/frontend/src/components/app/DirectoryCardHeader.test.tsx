import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DirectoryCardHeader } from "./DirectoryCardHeader";

describe("DirectoryCardHeader Component", () => {
  it("renders display name, avatar initials, and subtitle", () => {
    const html = renderToStaticMarkup(
      <DirectoryCardHeader
        id="dir-1"
        displayName="Muhammad Ali"
        gender="male"
        isSelected={false}
        onSelect={vi.fn()}
        selectAriaLabel="Select Muhammad Ali"
        subtitle={<span id="sub-1">Grade 10</span>}
      />,
    );

    expect(html).toContain("Muhammad Ali");
    expect(html).toContain("MA");
    expect(html).toContain("Grade 10");
    expect(html).toContain('aria-label="Select Muhammad Ali"');
  });

  it("renders clickable button when onView and viewAriaLabel are supplied", () => {
    const html = renderToStaticMarkup(
      <DirectoryCardHeader
        id="dir-2"
        displayName="Fatima Zahra"
        gender="female"
        isSelected={false}
        onSelect={vi.fn()}
        selectAriaLabel="Select Fatima"
        onView={vi.fn()}
        viewAriaLabel="View profile of Fatima Zahra"
      />,
    );

    expect(html).toContain("<button");
    expect(html).toContain('aria-label="View profile of Fatima Zahra"');
  });

  it("omits checkbox when showSelect is false", () => {
    const html = renderToStaticMarkup(
      <DirectoryCardHeader
        id="dir-3"
        displayName="Ali Raza"
        isSelected={false}
        onSelect={vi.fn()}
        selectAriaLabel="Select Ali"
        showSelect={false}
      />,
    );

    expect(html).not.toContain('role="checkbox"');
  });

  it("omits hover scale motion class when reducedMotion is true", () => {
    const html = renderToStaticMarkup(
      <DirectoryCardHeader
        id="dir-4"
        displayName="Zainab"
        isSelected={false}
        onSelect={vi.fn()}
        selectAriaLabel="Select Zainab"
        reducedMotion={true}
      />,
    );

    expect(html).not.toContain("group-hover:scale-105");
  });
});
