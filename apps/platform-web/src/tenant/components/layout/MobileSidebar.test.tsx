import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { School } from "lucide-react";
import MobileSidebar from "./MobileSidebar";
import type { NavItem } from "@/lib/config/navConfig";

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({ logoUrl: "", appName: "MMS" }),
}));

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Amina Accountant", email: "amina@test.com" },
    logout: vi.fn(),
  }),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mms/fe-core/hooks", () => ({
  useOverlayBehavior: () => ({ current: null }),
}));

vi.mock("@/tenant/hooks/useIndustryTerminology", () => ({
  useIndustryTerminology: () => ({
    facultyLabel: "Staff & Team",
    staffSingular: "Staff",
    studentLabel: "Guests & Patrons",
    locationLabel: "Site",
  }),
  resolveNavLabel: (key: string) => key,
}));

const mockItems: NavItem[] = [{ labelKey: "nav.dashboard", icon: School, path: "/" }];

vi.mock("@/tenant/components/layout/useSidebarNav", () => ({
  useSidebarNav: () => ({
    openMenus: {},
    toggleMenu: vi.fn(),
    visibleMenuItems: mockItems,
  }),
}));

describe("MobileSidebar", () => {
  it("returns null when open is false", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MobileSidebar open={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(html).toBe("");
  });

  it("renders mobile navigation region when open is true", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MobileSidebar open={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(html).toContain("nav.mobileNavigation");
    expect(html).toContain("nav.dashboard");
  });
});
