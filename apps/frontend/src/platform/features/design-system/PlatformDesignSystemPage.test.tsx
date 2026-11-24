import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PlatformDesignSystemPage from "@/platform/features/design-system/PlatformDesignSystemPage";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/platform/features/design-system/components/DesignSystemGallery", () => ({
  DesignSystemGallery: () => <div data-testid="design-system-gallery">Gallery</div>,
}));

describe("PlatformDesignSystemPage", () => {
  it("given design system route, should render ModulePageShell with gallery", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformDesignSystemPage />
      </MemoryRouter>,
    );

    expect(html).toContain("platform.designSystemTitle");
    expect(html).toContain("platform.designSystemSubtitle");
    expect(html).toContain('data-testid="design-system-gallery"');
  });
});
