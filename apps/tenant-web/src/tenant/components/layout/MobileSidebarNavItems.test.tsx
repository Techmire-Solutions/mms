import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GraduationCap, School } from "lucide-react";
import { MobileSidebarNavItems } from "./MobileSidebarNavItems";
import type { NavItem } from "@/lib/config/navConfig";

vi.mock("react-router-dom", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/routing/routePrefetch", () => ({
  prefetchRoute: vi.fn(),
}));

vi.mock("@/tenant/hooks/useIndustryTerminology", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/tenant/hooks/useIndustryTerminology")>();
  return {
    ...actual,
    useIndustryTerminology: () => ({
      facultyLabel: "Staff & Team",
      staffSingular: "Staff",
      studentLabel: "Guests & Patrons",
      locationLabel: "Site",
    }),
  };
});

const items: NavItem[] = [
  { labelKey: "nav.faculty", icon: School, path: "/faculty" },
  { labelKey: "nav.students", icon: GraduationCap, path: "/students" },
];

describe("MobileSidebarNavItems", () => {
  it("renders industry terminology labels for faculty and students", () => {
    const html = renderToStaticMarkup(
      <MobileSidebarNavItems
        items={items}
        openMenus={{}}
        onToggleMenu={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("Staff &amp; Team");
    expect(html).toContain("Guests &amp; Patrons");
    expect(html).not.toContain("nav.faculty");
    expect(html).not.toContain("nav.students");
  });
});
