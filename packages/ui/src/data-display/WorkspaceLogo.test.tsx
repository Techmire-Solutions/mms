import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceLogo } from "./WorkspaceLogo";

describe("WorkspaceLogo Component (@shared/ui)", () => {
  it("keeps stable dimensions when callers add custom styling", () => {
    const html = renderToStaticMarkup(
      <WorkspaceLogo
        logoUrl="/platform-logo.webp"
        madrasaName="Darul Quran"
        className="rounded-xl border-border/40"
      />,
    );

    expect(html).toContain("h-10");
    expect(html).toContain("w-10");
    expect(html).toContain("shrink-0");
    expect(html).toContain("object-contain");
    expect(html).toContain("rounded-xl");
    expect(html).toContain('alt="Darul Quran"');
  });

  it("uses stable dimensions and accessible label for initials fallback", () => {
    const html = renderToStaticMarkup(
      <WorkspaceLogo madrasaName="Darul Quran" className="rounded-xl" />,
    );

    expect(html).toContain("h-10");
    expect(html).toContain("w-10");
    expect(html).toContain("shrink-0");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Darul Quran"');
    expect(html).toContain("م");
  });

  it("supports size tokens (sm, md, lg)", () => {
    const htmlSm = renderToStaticMarkup(<WorkspaceLogo size="sm" madrasaName="Al-Huda" />);
    expect(htmlSm).toContain("h-8");
    expect(htmlSm).toContain("w-8");

    const htmlLg = renderToStaticMarkup(<WorkspaceLogo size="lg" madrasaName="Al-Huda" />);
    expect(htmlLg).toContain("h-12");
    expect(htmlLg).toContain("w-12");
  });

  it("renders custom fallback text when provided", () => {
    const html = renderToStaticMarkup(<WorkspaceLogo madrasaName="Al-Huda" fallbackText="AH" />);
    expect(html).toContain("AH");
  });

  it("applies lazy loading and async decoding by default", () => {
    const html = renderToStaticMarkup(<WorkspaceLogo logoUrl="/logo.png" madrasaName="Al-Huda" />);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
  });

  it("elevates loading to eager when fetchPriority is high", () => {
    const html = renderToStaticMarkup(
      <WorkspaceLogo logoUrl="/logo.png" madrasaName="Al-Huda" fetchPriority="high" />,
    );
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
  });
});
