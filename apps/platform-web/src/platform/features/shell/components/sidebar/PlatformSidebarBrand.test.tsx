import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PlatformSidebarBrand } from "@/platform/features/shell/components/sidebar/PlatformSidebarBrand";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

describe("PlatformSidebarBrand", () => {
  it("renders brand identity and logo", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformSidebarBrand collapsed={false} reducedMotion={true} onCloseMobile={vi.fn()} />
      </MemoryRouter>,
    );

    expect(html).toContain("entry.productName");
    expect(html).toContain("platform.consoleTitle");
    expect(html).toContain('alt="Platform Logo"');
  });

  it("renders mobile close button when isMobile is true", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformSidebarBrand
          isMobile={true}
          collapsed={false}
          reducedMotion={true}
          onCloseMobile={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="nav.closeSidebar"');
    expect(html).toContain('type="button"');
  });
});
