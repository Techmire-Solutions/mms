import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BookOpen, LayoutDashboard } from "lucide-react";
import { AppSidebarNav, type AppNavLink, type AppNavSection } from "./AppSidebarNav";

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
}));

const link = (id: string, label: string, path: string, active = false): AppNavLink => ({
  id,
  label,
  icon: LayoutDashboard,
  path,
  active,
});

const headed: AppNavSection[] = [
  {
    id: "ops",
    label: "Operations",
    entries: [{ kind: "link", link: link("sys", "System", "/system") }],
  },
];

const grouped: AppNavSection[] = [
  {
    id: "tenant",
    entries: [
      { kind: "link", link: link("home", "Home", "/home") },
      {
        kind: "group",
        group: {
          id: "academics",
          label: "Academics",
          icon: BookOpen,
          active: false,
          open: true,
          items: [link("students", "Students", "/students", true)],
        },
      },
    ],
  },
];

describe("AppSidebarNav", () => {
  it("renders a section header, its links and the nav aria-label", () => {
    const html = renderToStaticMarkup(
      <AppSidebarNav sections={headed} collapsed={false} layoutId="t" navAriaLabel="Main nav" />,
    );
    expect(html).toContain("Operations");
    expect(html).toContain("System");
    expect(html).toContain('href="/system"');
    expect(html).toContain('aria-label="Main nav"');
  });

  it("renders an open group with its sub-links", () => {
    const html = renderToStaticMarkup(
      <AppSidebarNav sections={grouped} collapsed={false} layoutId="t" />,
    );
    expect(html).toContain("Academics");
    expect(html).toContain("Home");
    expect(html).toContain("Students");
    expect(html).toContain('href="/students"');
  });

  it("hides sub-links when the group is closed", () => {
    const closed: AppNavSection[] = [
      {
        id: "tenant",
        entries: [
          {
            kind: "group",
            group: {
              id: "academics",
              label: "Academics",
              icon: BookOpen,
              active: false,
              open: false,
              items: [link("students", "Students", "/students")],
            },
          },
        ],
      },
    ];
    const html = renderToStaticMarkup(
      <AppSidebarNav sections={closed} collapsed={false} layoutId="t" />,
    );
    expect(html).toContain("Academics");
    expect(html).not.toContain("Students");
  });

  it("gives icon-only links an accessible name in the collapsed rail", () => {
    const flat: AppNavSection[] = [
      { id: "tenant", entries: [{ kind: "link", link: link("home", "Home", "/home", true) }] },
    ];
    const html = renderToStaticMarkup(<AppSidebarNav sections={flat} collapsed layoutId="t" />);
    expect(html).toContain('aria-label="Home"');
    expect(html).not.toContain(">Home<");
  });
});
