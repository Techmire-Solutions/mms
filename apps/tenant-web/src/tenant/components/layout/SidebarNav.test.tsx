import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { School, BookOpen } from "lucide-react";
import { SidebarNav } from "./SidebarNav";
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

vi.mock("@/tenant/hooks/useIndustryTerminology", () => ({
  useIndustryTerminology: () => ({
    facultyLabel: "Staff & Team",
    staffSingular: "Staff",
    studentLabel: "Students",
    locationLabel: "Campus",
  }),
  resolveNavLabel: (key: string) => (key === "nav.faculty" ? "Staff & Team" : key),
}));

const mockItems: NavItem[] = [
  { labelKey: "nav.faculty", icon: School, path: "/faculty" },
  {
    labelKey: "nav.academics",
    icon: BookOpen,
    subItems: [{ labelKey: "nav.sessions", icon: BookOpen, path: "/sessions" }],
  },
];

describe("SidebarNav", () => {
  it("renders nav links and expandable groups with resolved labels", () => {
    const html = renderToStaticMarkup(
      <SidebarNav
        collapsed={false}
        locationPathname="/faculty"
        visibleMenuItems={mockItems}
        openMenus={{ "nav.academics": true }}
        onToggleMenu={vi.fn()}
      />,
    );

    expect(html).toContain("Staff &amp; Team");
    expect(html).toContain("nav.academics");
  });
});
