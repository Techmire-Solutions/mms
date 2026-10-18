import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformSidebarNav } from "./PlatformSidebarNav";
import { LayoutDashboard } from "lucide-react";
import type { PlatformNavItem } from "@/platform/lib/platformNav";

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

  it("renders collapsed sidebar without errors in RTL", () => {
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
