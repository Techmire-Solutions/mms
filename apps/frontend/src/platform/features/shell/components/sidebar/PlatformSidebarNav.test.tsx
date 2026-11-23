import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformSidebarNav } from "@/platform/features/shell/components/sidebar/PlatformSidebarNav";
import { LayoutDashboard } from "lucide-react";
import type { PlatformNavItem } from "@/platform/features/shell/lib/platformNav";

let currentDir = "ltr";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    dir: currentDir,
  }),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/platform/dashboard" }),
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const mockSections: { section: "overview"; items: PlatformNavItem[] }[] = [
  {
    section: "overview",
    items: [
      {
        id: "dashboard",
        path: "/platform/dashboard",
        labelKey: "dashboard.title",
        icon: LayoutDashboard,
        section: "overview",
        isVisible: () => true,
      },
    ],
  },
];

import { TooltipProvider } from "@shared/ui";

describe("PlatformSidebarNav", () => {
  it("renders navigation links in expanded mode", () => {
    currentDir = "ltr";
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <PlatformSidebarNav
          sections={mockSections}
          collapsed={false}
          isMobile={false}
          reducedMotion={false}
          closeMobileSidebar={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(html).toContain("dashboard.title");
    expect(html).toContain("platform.navAria");
  });

  it("renders collapsed sidebar without errors in LTR", () => {
    currentDir = "ltr";
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <PlatformSidebarNav
          sections={mockSections}
          collapsed={true}
          isMobile={false}
          reducedMotion={false}
          closeMobileSidebar={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(html).toBeDefined();
    expect(html).toContain("platform.navAria");
  });

  it("pins the console nav to LTR at the source level", () => {
    const source = readFileSync(
      join(process.cwd(), "src/platform/features/shell/components/sidebar/PlatformSidebarNav.tsx"),
      "utf8",
    );
    expect(source).toContain('dir="ltr"');
    expect(source).not.toContain("dir={dir}");
  });

  it("renders collapsed sidebar without errors even when the translation direction is RTL", () => {
    currentDir = "rtl";
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <PlatformSidebarNav
          sections={mockSections}
          collapsed={true}
          isMobile={false}
          reducedMotion={false}
          closeMobileSidebar={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(html).toBeDefined();
    expect(html).toContain("platform.navAria");
  });
});
