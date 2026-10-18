import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WorkspaceLogo from "./WorkspaceLogo";

describe("WorkspaceLogo", () => {
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
  });

  it("uses the same stable dimensions for the initials fallback", () => {
    const html = renderToStaticMarkup(
      <WorkspaceLogo madrasaName="Darul Quran" className="rounded-xl" />,
    );

    expect(html).toContain("h-10");
    expect(html).toContain("w-10");
    expect(html).toContain("shrink-0");
  });
});
