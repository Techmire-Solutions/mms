import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LogoMark, PlatformLogoMark } from "./LogoMark";

describe("LogoMark & PlatformLogoMark (@shared/ui)", () => {
  it("renders large logo mark by default with modern priority attributes", () => {
    const html = renderToStaticMarkup(<LogoMark />);
    expect(html).toContain("h-20 w-20");
    expect(html).toContain("/platform-logo.webp");
    expect(html).toContain('alt="Product Logo"');
    expect(html).toContain('width="80"');
    expect(html).toContain('height="80"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('fetchPriority="high"');
  });

  it("renders small logo mark when size='sm' with proportional dimensions", () => {
    const html = renderToStaticMarkup(<LogoMark size="sm" alt="Custom Logo" />);
    expect(html).toContain("h-9 w-9");
    expect(html).toContain('alt="Custom Logo"');
    expect(html).toContain('width="36"');
    expect(html).toContain('height="36"');
  });

  it("exports PlatformLogoMark as an alias", () => {
    expect(PlatformLogoMark).toBe(LogoMark);
    const html = renderToStaticMarkup(<PlatformLogoMark size="sm" />);
    expect(html).toContain("h-9 w-9");
  });
});
